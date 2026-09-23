import { FastifyInstance } from 'fastify';
import { prisma } from '../../database/prisma';
import { CollectionQueue } from './collection.queue';

const queue = new CollectionQueue();

export async function collectionsRoutes(app: FastifyInstance) {
  // Create a new collection job
  app.post('/', async (req, reply) => {
    const { municipalityId, year, months } = req.body as {
      municipalityId: string;
      year: number;
      months: number[];
    };

    if (!municipalityId || !year || !months?.length) {
      return reply.status(400).send({ error: 'municipalityId, year, and months are required' });
    }

    const municipality = await prisma.municipality.findUnique({ where: { id: municipalityId } });
    if (!municipality) {
      return reply.status(404).send({ error: 'Municipality not found' });
    }

    const collection = await prisma.collection.create({
      data: {
        municipalityId,
        year,
        months,
        status: 'pending',
        progress: 0,
      },
    });

    // Add to queue
    queue.add(collection.id);

    await prisma.systemLog.create({
      data: {
        level: 'info',
        action: 'COLLECTION_CREATED',
        message: `Collection job created for ${municipality.city} - ${year}`,
        data: { collectionId: collection.id, municipalityId, year, months },
      },
    });

    return reply.status(201).send(collection);
  });

  // List collections
  app.get('/', async (req, reply) => {
    const { municipalityId, status, page = '1', limit = '20' } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [items, total] = await Promise.all([
      prisma.collection.findMany({
        where: {
          ...(municipalityId && { municipalityId }),
          ...(status && { status }),
        },
        include: {
          municipality: { select: { city: true, state: true } },
          _count: { select: { logs: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.collection.count({
        where: {
          ...(municipalityId && { municipalityId }),
          ...(status && { status }),
        },
      }),
    ]);

    return reply.send({ items, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  });

  // Get single collection with logs
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const collection = await prisma.collection.findUnique({
      where: { id },
      include: {
        municipality: { select: { city: true, state: true } },
        logs: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });

    if (!collection) return reply.status(404).send({ error: 'Not found' });
    return reply.send(collection);
  });

  // Cancel/delete collection
  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.collection.update({
      where: { id },
      data: { status: 'error', errorMessage: 'Cancelled by user' },
    });
    return reply.send({ success: true });
  });
}
