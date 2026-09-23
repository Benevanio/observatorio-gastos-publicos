import { Prisma } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../database/prisma';

const createSchema = z.object({
  state: z.string().length(2),
  city: z.string().min(1),
  ibgeCode: z.string().optional(),
  cnpj: z.string().optional(),
  transparencyPortalUrl: z.string().url().optional(),
  apiUrl: z.string().url().optional(),
  enabled: z.boolean().optional().default(true),
});

const updateSchema = createSchema.partial();

export async function municipalitiesRoutes(app: FastifyInstance) {
  // List all municipalities
  app.get('/', async (req, reply) => {
    const { state, enabled } = req.query as {
      state?: string;
      enabled?: string;
    };

    const municipalities = await prisma.municipality.findMany({
      where: {
        ...(state && { state }),
        ...(enabled !== undefined && {
          enabled: enabled === 'true',
        }),
      },
      include: {
        _count: {
          select: {
            procurements: true,
            contracts: true,
            findings: true,
          },
        },
      },
      orderBy: [{ state: 'asc' }, { city: 'asc' }],
    });

    return reply.send(municipalities);
  });

  // Get single municipality
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as {
      id: string;
    };

    const municipality = await prisma.municipality.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            procurements: true,
            contracts: true,
            payments: true,
            findings: true,
            collections: true,
          },
        },
        collections: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 5,
        },
      },
    });

    if (!municipality) {
      return reply.status(404).send({
        error: 'Municipality not found',
      });
    }

    return reply.send(municipality);
  });

  // Create municipality
  app.post('/', async (req, reply) => {
    const parsed = createSchema.parse(req.body);

    const data: Prisma.MunicipalityCreateInput = {
      state: parsed.state,
      city: parsed.city,
      ibgeCode: parsed.ibgeCode,
      cnpj: parsed.cnpj,
      transparencyPortalUrl: parsed.transparencyPortalUrl,
      apiUrl: parsed.apiUrl,
      enabled: parsed.enabled,
    };

    const municipality = await prisma.municipality.create({
      data,
    });

    await prisma.systemLog.create({
      data: {
        level: 'info',
        action: 'MUNICIPALITY_CREATED',
        message: `Municipality created: ${municipality.city}/${municipality.state}`,
        data: {
          municipalityId: municipality.id,
        },
      },
    });

    return reply.status(201).send(municipality);
  });

  // Update municipality
  app.put('/:id', async (req, reply) => {
    const { id } = req.params as {
      id: string;
    };

    const parsed = updateSchema.parse(req.body);

    const data: Prisma.MunicipalityUpdateInput = {
      ...(parsed.state !== undefined && {
        state: parsed.state,
      }),
      ...(parsed.city !== undefined && {
        city: parsed.city,
      }),
      ...(parsed.ibgeCode !== undefined && {
        ibgeCode: parsed.ibgeCode,
      }),
      ...(parsed.cnpj !== undefined && {
        cnpj: parsed.cnpj,
      }),
      ...(parsed.transparencyPortalUrl !== undefined && {
        transparencyPortalUrl: parsed.transparencyPortalUrl,
      }),
      ...(parsed.apiUrl !== undefined && {
        apiUrl: parsed.apiUrl,
      }),
      ...(parsed.enabled !== undefined && {
        enabled: parsed.enabled,
      }),
    };

    const municipality = await prisma.municipality.update({
      where: { id },
      data,
    });

    return reply.send(municipality);
  });

  // Delete municipality
  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as {
      id: string;
    };

    await prisma.municipality.delete({
      where: { id },
    });

    return reply.send({
      success: true,
    });
  });

  // Detect portal capabilities
  app.post('/:id/detect', async (req, reply) => {
    const { id } = req.params as {
      id: string;
    };

    const municipality = await prisma.municipality.findUnique({
      where: { id },
    });

    if (!municipality) {
      return reply.status(404).send({
        error: 'Municipality not found',
      });
    }

    const capabilities = await detectPortalCapabilities(
      municipality,
    );

    return reply.send(capabilities);
  });

  // Get municipality stats
  app.get('/:id/stats', async (req, reply) => {
    const { id } = req.params as {
      id: string;
    };

    const { year } = req.query as {
      year?: string;
    };

    const yearFilter = year ? parseInt(year, 10) : undefined;

    const [
      procurements,
      contracts,
      payments,
      findings,
      suppliers,
    ] = await Promise.all([
      prisma.procurement.aggregate({
        where: {
          municipalityId: id,
          ...(yearFilter !== undefined && {
            year: yearFilter,
          }),
        },
        _count: true,
        _sum: {
          estimatedValue: true,
          awardedValue: true,
        },
      }),

      prisma.contract.count({
        where: {
          municipalityId: id,
        },
      }),

      prisma.payment.aggregate({
        where: {
          municipalityId: id,
        },
        _count: true,
        _sum: {
          value: true,
        },
      }),

      prisma.analysisFinding.count({
        where: {
          municipalityId: id,
        },
      }),

      prisma.procurementSupplier.groupBy({
        by: ['supplierId'],
        where: {
          procurement: {
            municipalityId: id,
          },
        },
      }),
    ]);

    return reply.send({
      procurements: {
        count: procurements._count,
        totalEstimated: procurements._sum.estimatedValue,
        totalAwarded: procurements._sum.awardedValue,
      },
      contracts: {
        count: contracts,
      },
      payments: {
        count: payments._count,
        total: payments._sum.value,
      },
      findings: {
        count: findings,
      },
      suppliers: {
        count: suppliers.length,
      },
    });
  });
}

async function detectPortalCapabilities(municipality: {
  transparencyPortalUrl: string | null;
  city: string;
}) {
  const url = municipality.transparencyPortalUrl || '';

  const capabilities = {
    hasApi: false,
    hasScraping: false,
    hasExport: false,
    adapterType: 'generic',
    details: {} as Record<string, unknown>,
  };

  if (url.includes('portodafolha.se.gov.br')) {
    capabilities.hasApi = true;
    capabilities.hasScraping = true;
    capabilities.hasExport = true;
    capabilities.adapterType = 'porto_da_folha';

    capabilities.details = {
      portalSystem: 'Sistema Municipal de Transparência',
      endpoints: [
        {
          type: 'procurements',
          path: '/portal/licitacoes',
        },
        {
          type: 'contracts',
          path: '/portal/contratos',
        },
      ],
      exportFormats: ['html', 'csv'],
      rateLimitRps: 1,
    };
  } else if (url.includes('.gov.br')) {
    capabilities.hasScraping = true;
    capabilities.hasExport = true;
    capabilities.adapterType = 'generic_municipal';

    capabilities.details = {
      portalSystem: 'Portal Municipal Genérico',
      note: 'Adaptador genérico. Pode requerer configuração manual.',
    };
  }

  return capabilities;
}