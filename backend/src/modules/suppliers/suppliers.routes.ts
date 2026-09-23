import { FastifyInstance } from 'fastify';
import { prisma } from '../../database/prisma';

export async function suppliersRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const { municipalityId, search, page = '1', limit = '20' } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { document: { contains: search, mode: 'insensitive' as const } },
          { city: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(municipalityId && {
        OR: [
          { contracts: { some: { municipalityId } } },
          { payments: { some: { municipalityId } } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        include: {
          _count: {
            select: { contracts: true, procurements: true, payments: true },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.supplier.count({ where }),
    ]);

    return reply.send({
      items,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    });
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        contracts: {
          include: { municipality: { select: { city: true, state: true } } },
          orderBy: { startDate: 'desc' },
        },
        procurements: {
          include: { procurement: { select: { processNumber: true, object: true, year: true, modality: true } } },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
          take: 20,
        },
      },
    });

    if (!supplier) return reply.status(404).send({ error: 'Not found' });

    const totalContracts = supplier.contracts.reduce(
      (sum, c) => sum + Number(c.currentValue || c.initialValue || 0),
      0
    );
    const totalPayments = supplier.payments.reduce((sum, p) => sum + Number(p.value || 0), 0);

    return reply.send({
      ...supplier,
      totalContractValue: totalContracts,
      totalPayments,
    });
  });

  app.get('/ranking/:municipalityId', async (req, reply) => {
    const { municipalityId } = req.params as { municipalityId: string };

    const contracts = await prisma.contract.findMany({
      where: { municipalityId, supplierId: { not: null } },
      include: { supplier: { select: { id: true, name: true, document: true } } },
    });

    const totalValue = contracts.reduce((sum, c) => sum + Number(c.currentValue || c.initialValue || 0), 0);

    const ranking = new Map<
      string,
      {
        supplierId: string;
        name: string;
        document: string | null;
        contractCount: number;
        totalValue: number;
        percentage: number;
      }
    >();

    for (const contract of contracts) {
      if (!contract.supplier) continue;
      const val = Number(contract.currentValue || contract.initialValue || 0);
      const existing = ranking.get(contract.supplierId!);
      if (existing) {
        existing.contractCount++;
        existing.totalValue += val;
        existing.percentage = (existing.totalValue / totalValue) * 100;
      } else {
        ranking.set(contract.supplierId!, {
          supplierId: contract.supplierId!,
          name: contract.supplier.name,
          document: contract.supplier.document,
          contractCount: 1,
          totalValue: val,
          percentage: (val / totalValue) * 100,
        });
      }
    }

    const result = Array.from(ranking.values()).sort((a, b) => b.totalValue - a.totalValue);

    return reply.send({ ranking: result, totalValue });
  });
}
