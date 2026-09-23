import { FastifyInstance } from 'fastify';
import { prisma } from '../../database/prisma';

export async function paymentsRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const {
      municipalityId,
      supplierId,
      search,
      page = '1',
      limit = '20',
    } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(municipalityId && { municipalityId }),
      ...(supplierId && { supplierId }),
      ...(search && {
        OR: [
          { description: { contains: search, mode: 'insensitive' as const } },
          { empenho: { contains: search, mode: 'insensitive' as const } },
          { organ: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          municipality: { select: { city: true, state: true } },
          supplier: { select: { name: true, document: true } },
          contract: { select: { contractNumber: true, object: true } },
        },
        orderBy: { paymentDate: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.payment.count({ where }),
    ]);

    return reply.send({
      items,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    });
  });

  app.get('/stats/monthly', async (req, reply) => {
    const { municipalityId } = req.query as Record<string, string>;

    const payments = await prisma.payment.findMany({
      where: { ...(municipalityId && { municipalityId }), paymentDate: { not: null } },
      select: { paymentDate: true, value: true },
    });

    const monthly: Record<string, number> = {};
    for (const p of payments) {
      if (!p.paymentDate) continue;
      const key = `${p.paymentDate.getFullYear()}-${String(p.paymentDate.getMonth() + 1).padStart(2, '0')}`;
      monthly[key] = (monthly[key] || 0) + Number(p.value || 0);
    }

    return reply.send(
      Object.entries(monthly)
        .map(([month, total]) => ({ month, total }))
        .sort((a, b) => a.month.localeCompare(b.month))
    );
  });
}
