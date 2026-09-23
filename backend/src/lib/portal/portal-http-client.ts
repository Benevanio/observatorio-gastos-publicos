import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { randomUUID } from 'crypto';
import http from 'http';
import https from 'https';
import { env } from '../../config/env';
import { getRedis, redisAvailable } from '../redis';
import { HostLimiter, sleep } from './concurrency';
import { portalMetrics } from './portal-metrics';
import {
  PortalError,
  codeFromHttpStatus,
  codeFromNetworkError,
  isRetryableCode,
} from './portal-error';

export interface PortalRequestOptions {
  portal: string;
  url: string;
  method?: 'GET' | 'POST';
  params?: Record<string, string | number | undefined>;
  data?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
  cacheTtlSeconds?: number;
  signal?: AbortSignal;
  correlationId?: string;
}

export interface PortalResponse {
  data: string;
  status: number;
  durationMs: number;
  attempts: number;
  fromCache: boolean;
  correlationId: string;
  finalUrl: string;
}

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-api-key',
  'token',
  'password',
]);

export class PortalHttpClient {
  private readonly axios: AxiosInstance;
  private readonly limiter: HostLimiter;

  constructor() {
    this.limiter = new HostLimiter(env.portal.maxConcurrency, env.portal.minIntervalMs);

    const agentOpts = { keepAlive: true, timeout: env.portal.connectTimeoutMs };

    this.axios = axios.create({
      httpAgent: new http.Agent(agentOpts),
      httpsAgent: new https.Agent(agentOpts),
      maxRedirects: 5,
      maxContentLength: env.portal.maxResponseBytes,
      maxBodyLength: env.portal.maxResponseBytes,
      decompress: true,
      validateStatus: () => true,
      transitional: { clarifyTimeoutError: true },
    });
  }

  async get(options: Omit<PortalRequestOptions, 'method'>): Promise<PortalResponse> {
    return this.request({ ...options, method: 'GET' });
  }

  async request(options: PortalRequestOptions): Promise<PortalResponse> {
    const correlationId = options.correlationId ?? randomUUID();
    const host = hostOf(options.url);
    const endpoint = endpointOf(options.url);
    const maxRetries = options.maxRetries ?? env.portal.maxRetries;
    const timeoutMs = options.timeoutMs ?? env.portal.timeoutMs;

    const cacheKey = this.cacheKey(options);
    if (cacheKey) {
      const cached = await this.readCache(cacheKey);
      if (cached !== null) {
        portalMetrics.cacheHit(host);
        log('PORTAL_CACHE_HIT', { portal: options.portal, endpoint, correlationId });
        return {
          data: cached,
          status: 200,
          durationMs: 0,
          attempts: 0,
          fromCache: true,
          correlationId,
          finalUrl: options.url,
        };
      }
    }

    let lastError: PortalError | null = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      if (options.signal?.aborted) {
        throw new PortalError({
          code: 'ABORTED',
          message: 'Requisição cancelada antes de iniciar',
          portal: options.portal,
          endpoint,
          durationMs: 0,
          attempt,
          correlationId,
        });
      }

      const start = performance.now();

      try {
        const response = await this.limiter.run(host, () =>
          this.axios.request({
            url: options.url,
            method: options.method ?? 'GET',
            params: options.params,
            data: options.data,
            timeout: timeoutMs,
            signal: options.signal,
            headers: {
              'User-Agent': env.portal.userAgent,
              Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
              'Accept-Language': 'pt-BR,pt;q=0.9',
              'X-Correlation-Id': correlationId,
              ...options.headers,
            },
          })
        );

        const durationMs = performance.now() - start;
        const sizeBytes = responseSize(response);

        if (sizeBytes > env.portal.maxResponseBytes) {
          const err = new PortalError({
            code: 'RESPONSE_TOO_LARGE',
            message: `Resposta de ${sizeBytes} bytes excede o limite de ${env.portal.maxResponseBytes}`,
            portal: options.portal,
            endpoint,
            httpStatus: response.status,
            durationMs,
            attempt,
            correlationId,
          });
          portalMetrics.failure(host, durationMs, err.code, response.status);
          logError(err, sizeBytes);
          throw err;
        }

        if (response.status >= 400) {
          const code = codeFromHttpStatus(response.status);
          const err = new PortalError({
            code,
            message: `Portal respondeu HTTP ${response.status}`,
            portal: options.portal,
            endpoint,
            httpStatus: response.status,
            durationMs,
            attempt,
            correlationId,
            retryAfterMs: retryAfterMs(response),
          });

          portalMetrics.failure(host, durationMs, code, response.status);
          logError(err, sizeBytes);

          if (!err.retryable || attempt > maxRetries) throw err;
          lastError = err;
          await this.backoff(host, attempt, err.retryAfterMs);
          continue;
        }

        portalMetrics.success(host, durationMs, response.status);
        log('PORTAL', {
          portal: options.portal,
          endpoint,
          status: response.status,
          duration: `${Math.round(durationMs)}ms`,
          attempt,
          bytes: sizeBytes,
          correlationId,
        });

        const body =
          typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

        if (cacheKey) await this.writeCache(cacheKey, body, options.cacheTtlSeconds);

        return {
          data: body,
          status: response.status,
          durationMs,
          attempts: attempt,
          fromCache: false,
          correlationId,
          finalUrl: finalUrlOf(response) ?? options.url,
        };
      } catch (err) {
        const durationMs = performance.now() - start;

        if (err instanceof PortalError) {
          if (!err.retryable || attempt > maxRetries) throw err;
          lastError = err;
          continue;
        }

        const code = codeFromNetworkError(err);
        const portalErr = new PortalError({
          code,
          message: describeNetworkError(code, err),
          portal: options.portal,
          endpoint,
          durationMs,
          attempt,
          correlationId,
          cause: err,
        });

        portalMetrics.failure(host, durationMs, code);
        logError(portalErr);

        if (!isRetryableCode(code) || attempt > maxRetries) throw portalErr;
        lastError = portalErr;
        await this.backoff(host, attempt);
      }
    }

    throw (
      lastError ??
      new PortalError({
        code: 'UNKNOWN',
        message: 'Falha desconhecida ao acessar o portal',
        portal: options.portal,
        endpoint,
        durationMs: 0,
        attempt: maxRetries + 1,
        correlationId,
      })
    );
  }

  private async backoff(host: string, attempt: number, retryAfterMs?: number): Promise<void> {
    portalMetrics.retry(host);

    const exponential = env.portal.retryBaseDelayMs * 2 ** (attempt - 1);
    const capped = Math.min(exponential, env.portal.retryMaxDelayMs);
    const jittered = Math.random() * capped;
    const delay = Math.max(retryAfterMs ?? 0, jittered);

    await sleep(Math.min(delay, env.portal.retryMaxDelayMs));
  }

  private cacheKey(options: PortalRequestOptions): string | null {
    const ttl = options.cacheTtlSeconds ?? env.portal.cacheTtlSeconds;
    const method = options.method ?? 'GET';
    if (!env.portal.cacheEnabled || ttl <= 0 || method !== 'GET' || !redisAvailable()) return null;

    const params = options.params ? JSON.stringify(Object.entries(options.params).sort()) : '';
    return `portal:cache:${options.url}:${params}`;
  }

  private async readCache(key: string): Promise<string | null> {
    try {
      return (await getRedis()?.get(key)) ?? null;
    } catch {
      return null;
    }
  }

  private async writeCache(key: string, body: string, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? env.portal.cacheTtlSeconds;
    try {
      await getRedis()?.set(key, body, 'EX', ttl);
    } catch {
    }
  }

  limiterStats() {
    return this.limiter.stats();
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'invalid-url';
  }
}

export function endpointOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function finalUrlOf(response: AxiosResponse): string | undefined {
  const req = response.request as { res?: { responseUrl?: string } } | undefined;
  return req?.res?.responseUrl;
}

function responseSize(response: AxiosResponse): number {
  const header = response.headers?.['content-length'];
  if (header) return Number.parseInt(String(header), 10) || 0;
  if (typeof response.data === 'string') return Buffer.byteLength(response.data);
  return Buffer.byteLength(JSON.stringify(response.data ?? ''));
}

function retryAfterMs(response: AxiosResponse): number | undefined {
  const raw = response.headers?.['retry-after'];
  if (!raw) return undefined;
  const seconds = Number.parseInt(String(raw), 10);
  return Number.isNaN(seconds) ? undefined : seconds * 1000;
}

function describeNetworkError(code: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  switch (code) {
    case 'DNS_ERROR':
      return `DNS nao resolveu o host do portal (${message})`;
    case 'CONNECTION_REFUSED':
      return `Portal recusou a conexao TCP (${message})`;
    case 'CONNECTION_RESET':
      return `Conexao encerrada pelo portal (${message})`;
    case 'TIMEOUT':
      return `Portal nao respondeu dentro do timeout (${message})`;
    case 'TLS_ERROR':
      return `Falha no handshake TLS com o portal (${message})`;
    default:
      return message;
  }
}

function log(tag: string, fields: Record<string, unknown>): void {
  const safe = Object.entries(fields)
    .filter(([k]) => !SENSITIVE_KEYS.has(k.toLowerCase()))
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  console.log(`[${tag}] ${safe}`);
}

function logError(err: PortalError, bytes?: number): void {
  log('PORTAL_ERROR', {
    portal: err.portal,
    endpoint: err.endpoint,
    error: err.code,
    status: err.httpStatus ?? '-',
    duration: `${Math.round(err.durationMs)}ms`,
    attempt: err.attempt,
    ...(bytes !== undefined ? { bytes } : {}),
    correlationId: err.correlationId,
  });
}

export const portalHttp = new PortalHttpClient();
