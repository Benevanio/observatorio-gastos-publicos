import { FastifyInstance } from 'fastify';
import { prisma } from '../../database/prisma';

export async function findingsRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const {
      municipalityId,
      type,
      severity,
      dismissed,
      page = '1',
      limit = '20',
    } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(municipalityId && { municipalityId }),
      ...(type && { type }),
      ...(severity && { severity }),
      ...(dismissed !== undefined ? { dismissed: dismissed === 'true' } : { dismissed: false }),
    };

    const [items, total] = await Promise.all([
      prisma.analysisFinding.findMany({
        where,
        include: {
          municipality: { select: { city: true, state: true } },
        },
        orderBy: [
          { severity: 'asc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: parseInt(limit),
      }),
      prisma.analysisFinding.count({ where }),
    ]);

    return reply.send({
      items,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    });
  });

  app.get('/summary', async (req, reply) => {
    const { municipalityId } = req.query as Record<string, string>;

    const findings = await prisma.analysisFinding.groupBy({
      by: ['severity', 'type'],
      where: {
        ...(municipalityId && { municipalityId }),
        dismissed: false,
      },
      _count: true,
    });

    return reply.send(findings);
  });

  app.patch('/:id/dismiss', async (req, reply) => {
    const { id } = req.params as { id: string };

    const finding = await prisma.analysisFinding.update({
      where: { id },
      data: { dismissed: true },
    });

    return reply.send(finding);
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.analysisFinding.delete({ where: { id } });
    return reply.send({ success: true });
  });
}
