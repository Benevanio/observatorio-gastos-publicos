import { FastifyInstance } from 'fastify';
import { prisma } from '../../database/prisma';

export async function contractsRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const {
      municipalityId,
      supplierId,
      status,
      search,
      page = '1',
      limit = '20',
    } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(municipalityId && { municipalityId }),
      ...(supplierId && { supplierId }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { contractNumber: { contains: search, mode: 'insensitive' as const } },
          { object: { contains: search, mode: 'insensitive' as const } },
          { organ: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        include: {
          municipality: { select: { city: true, state: true } },
          supplier: { select: { name: true, document: true } },
          amendments: true,
          _count: { select: { amendments: true, payments: true } },
        },
        orderBy: { startDate: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.contract.count({ where }),
    ]);

    const itemsWithStats = items.map((c) => ({
      ...c,
      amendmentCount: c._count.amendments,
      paymentCount: c._count.payments,
      increasePercentage:
        c.initialValue && c.currentValue
          ? (((Number(c.currentValue) - Number(c.initialValue)) / Number(c.initialValue)) * 100).toFixed(2)
          : null,
    }));

    return reply.send({
      items: itemsWithStats,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    });
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        municipality: true,
        supplier: true,
        procurement: true,
        amendments: { orderBy: { date: 'asc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });

    if (!contract) return reply.status(404).send({ error: 'Not found' });
    return reply.send(contract);
  });

  // Contracts with high amendment rate
  app.get('/stats/amendments', async (req, reply) => {
    const { municipalityId } = req.query as Record<string, string>;

    const contracts = await prisma.contract.findMany({
      where: {
        ...(municipalityId && { municipalityId }),
        amendments: { some: {} },
      },
      include: {
        supplier: { select: { name: true } },
        amendments: true,
      },
    });

    const result = contracts
      .map((c) => ({
        id: c.id,
        contractNumber: c.contractNumber,
        object: c.object,
        supplier: c.supplier?.name,
        initialValue: c.initialValue,
        currentValue: c.currentValue,
        amendmentCount: c.amendments.length,
        increasePercentage:
          c.initialValue && c.currentValue
            ? (((Number(c.currentValue) - Number(c.initialValue)) / Number(c.initialValue)) * 100).toFixed(2)
            : null,
      }))
      .sort((a, b) => b.amendmentCount - a.amendmentCount);

    return reply.send(result);
  });
}
