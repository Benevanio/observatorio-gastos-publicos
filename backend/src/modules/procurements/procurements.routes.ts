import { FastifyInstance } from 'fastify';
import { prisma } from '../../database/prisma';

export async function procurementsRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const {
      municipalityId,
      year,
      month,
      modality,
      status,
      search,
      page = '1',
      limit = '20',
    } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(municipalityId && { municipalityId }),
      ...(year && { year: parseInt(year) }),
      ...(month && { month: parseInt(month) }),
      ...(modality && { modality: { contains: modality, mode: 'insensitive' as const } }),
      ...(status && { status: { contains: status, mode: 'insensitive' as const } }),
      ...(search && {
        OR: [
          { processNumber: { contains: search, mode: 'insensitive' as const } },
          { object: { contains: search, mode: 'insensitive' as const } },
          { organ: { contains: search, mode: 'insensitive' as const } },
          { modality: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.procurement.findMany({
        where,
        include: {
          municipality: { select: { city: true, state: true } },
          suppliers: {
            include: { supplier: { select: { name: true, document: true } } },
          },
        },
        orderBy: { publicationDate: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.procurement.count({ where }),
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

    const procurement = await prisma.procurement.findUnique({
      where: { id },
      include: {
        municipality: true,
        suppliers: { include: { supplier: true } },
        contracts: {
          include: { supplier: true, amendments: true },
        },
      },
    });

    if (!procurement) return reply.status(404).send({ error: 'Not found' });
    return reply.send(procurement);
  });

  app.get('/stats/modalities', async (req, reply) => {
    const { municipalityId, year } = req.query as Record<string, string>;

    const items = await prisma.procurement.groupBy({
      by: ['modality'],
      where: {
        ...(municipalityId && { municipalityId }),
        ...(year && { year: parseInt(year) }),
        modality: { not: null },
      },
      _count: { id: true },
      _sum: { awardedValue: true, estimatedValue: true },
      orderBy: { _count: { id: 'desc' } },
    });

    return reply.send(items);
  });

  app.get('/stats/monthly', async (req, reply) => {
    const { municipalityId, year } = req.query as Record<string, string>;

    const items = await prisma.procurement.groupBy({
      by: ['month', 'year'],
      where: {
        ...(municipalityId && { municipalityId }),
        ...(year && { year: parseInt(year) }),
      },
      _count: { id: true },
      _sum: { awardedValue: true, estimatedValue: true },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    return reply.send(items);
  });
}
