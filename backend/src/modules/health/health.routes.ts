import { FastifyInstance } from 'fastify';
import { prisma } from '../../database/prisma';
import { env } from '../../config/env';
import { redisPing } from '../../lib/redis';

const startedAt = Date.now();

const CACHE_TTL_MS = 2_000;
let cached: { at: number; body: unknown; healthy: boolean } | null = null;

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health/live', async () => ({
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  }));

  app.get('/health', async (_req, reply) => {
    const now = Date.now();
    if (cached && now - cached.at < CACHE_TTL_MS) {
      return reply.status(cached.healthy ? 200 : 503).send(cached.body);
    }

    const [database, redis] = await Promise.all([checkDatabase(), redisPing()]);

    const healthy = database.ok;

    const body = {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((now - startedAt) / 1000),
      version: process.env.npm_package_version ?? '1.0.0',
      dependencies: {
        database,
        redis: env.redisEnabled
          ? { ...redis, required: false }
          : { ok: true, disabled: true, required: false },
      },
    };

    cached = { at: now, body, healthy };
    return reply.status(healthy ? 200 : 503).send(body);
  });

  app.get('/health/ready', async (_req, reply) => {
    const database = await checkDatabase();
    return reply
      .status(database.ok ? 200 : 503)
      .send({ status: database.ok ? 'ok' : 'unavailable', database });
  });
}

async function checkDatabase(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const start = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Math.round(performance.now() - start) };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
