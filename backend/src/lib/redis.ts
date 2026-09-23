import Redis from 'ioredis';
import { env } from '../config/env';

let client: Redis | null = null;
let available = false;
let lastError: string | null = null;

export function getRedis(): Redis | null {
  if (!env.redisEnabled) return null;

  if (!client) {
    client = new Redis(env.redisUrl, {
      lazyConnect: false,
      connectTimeout: 5_000,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 500, 5_000),
    });

    client.on('ready', () => {
      available = true;
      lastError = null;
      console.log('[REDIS] conectado em', redactRedisUrl(env.redisUrl));
    });

    client.on('error', (err: Error) => {
      available = false;
      lastError = err.message;
      console.error('[REDIS_ERROR]', err.message);
    });

    client.on('end', () => {
      available = false;
    });
  }

  return client;
}

export function redisAvailable(): boolean {
  return env.redisEnabled && available;
}

export function redisLastError(): string | null {
  return lastError;
}

export async function redisPing(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  if (!env.redisEnabled) return { ok: true };
  const c = getRedis();
  if (!c) return { ok: true };

  const start = performance.now();
  try {
    const pong = await c.ping();
    return { ok: pong === 'PONG', latencyMs: Math.round(performance.now() - start) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => client?.disconnect());
    client = null;
    available = false;
  }
}

export function redactRedisUrl(url: string): string {
  return url.replace(/\/\/([^@/]+)@/, '//***@');
}
