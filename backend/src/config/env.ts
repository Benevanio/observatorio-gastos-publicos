function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Variável de ambiente ${name} deve ser um inteiro. Recebido: "${raw}"`);
  }
  return parsed;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === '1' || raw.toLowerCase() === 'true';
}

function str(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw === undefined || raw === '' ? fallback : raw;
}

export const env = {
  nodeEnv: str('NODE_ENV', 'development'),
  isProduction: str('NODE_ENV', 'development') === 'production',
  host: str('HOST', '0.0.0.0'),
  port: int('PORT', 3001),
  logLevel: str('LOG_LEVEL', 'info'),

  corsOrigin: str('CORS_ORIGIN', 'http://localhost:3000'),
  databaseUrl: str('DATABASE_URL', ''),
  redisEnabled: bool('REDIS_ENABLED', true),
  redisUrl: str('REDIS_URL', 'redis://redis:6379'),

  portal: {
    timeoutMs: int('PORTAL_REQUEST_TIMEOUT_MS', 30_000),
    connectTimeoutMs: int('PORTAL_CONNECT_TIMEOUT_MS', 10_000),
    maxRetries: int('PORTAL_MAX_RETRIES', 3),
    retryBaseDelayMs: int('PORTAL_RETRY_BASE_DELAY_MS', 1_000),
    retryMaxDelayMs: int('PORTAL_RETRY_MAX_DELAY_MS', 15_000),
    maxConcurrency: int('PORTAL_MAX_CONCURRENCY', 2),
    minIntervalMs: int('PORTAL_MIN_INTERVAL_MS', 1_000),
    maxResponseBytes: int('PORTAL_MAX_RESPONSE_BYTES', 20 * 1024 * 1024),
    cacheTtlSeconds: int('PORTAL_CACHE_TTL_SECONDS', 3_600),
    cacheEnabled: bool('PORTAL_CACHE_ENABLED', true),
    userAgent: str(
      'PORTAL_USER_AGENT',
      'ObservatorioGastosPublicos/1.0 (+https://github.com/observatorio-gastos-publicos)'
    ),
  },
  collection: {
    concurrency: int('COLLECTION_CONCURRENCY', 2),
    pollIntervalMs: int('COLLECTION_POLL_INTERVAL_MS', 5_000),
    workerEnabled: bool('COLLECTION_WORKER_ENABLED', true),
  },
} as const;

export function corsOrigins(): string[] | boolean {
  if (env.corsOrigin === '*') return true;
  return env.corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
}
