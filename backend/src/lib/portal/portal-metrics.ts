import type { PortalErrorCode } from './portal-error';

interface HostStats {
  requests: number;
  success: number;
  error: number;
  timeout: number;
  retries: number;
  cacheHits: number;
  durations: number[];
  errorsByCode: Record<string, number>;
  lastStatus?: number;
  lastErrorCode?: PortalErrorCode;
  lastRequestAt?: string;
}

const MAX_SAMPLES = 1_000;

function emptyStats(): HostStats {
  return {
    requests: 0,
    success: 0,
    error: 0,
    timeout: 0,
    retries: 0,
    cacheHits: 0,
    durations: [],
    errorsByCode: {},
  };
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[Math.max(0, idx)]);
}

class PortalMetrics {
  private byHost = new Map<string, HostStats>();

  private stats(host: string): HostStats {
    let s = this.byHost.get(host);
    if (!s) {
      s = emptyStats();
      this.byHost.set(host, s);
    }
    return s;
  }

  private record(host: string, durationMs: number) {
    const s = this.stats(host);
    s.durations.push(durationMs);
    if (s.durations.length > MAX_SAMPLES) s.durations.shift();
  }

  success(host: string, durationMs: number, status: number) {
    const s = this.stats(host);
    s.requests++;
    s.success++;
    s.lastStatus = status;
    s.lastRequestAt = new Date().toISOString();
    this.record(host, durationMs);
  }

  failure(host: string, durationMs: number, code: PortalErrorCode, status?: number) {
    const s = this.stats(host);
    s.requests++;
    s.error++;
    if (code === 'TIMEOUT') s.timeout++;
    s.errorsByCode[code] = (s.errorsByCode[code] ?? 0) + 1;
    s.lastErrorCode = code;
    s.lastStatus = status;
    s.lastRequestAt = new Date().toISOString();
    this.record(host, durationMs);
  }

  retry(host: string) {
    this.stats(host).retries++;
  }

  cacheHit(host: string) {
    this.stats(host).cacheHits++;
  }

  snapshot() {
    const hosts: Record<string, unknown> = {};

    for (const [host, s] of this.byHost) {
      const sorted = [...s.durations].sort((a, b) => a - b);
      const sum = sorted.reduce((acc, v) => acc + v, 0);

      hosts[host] = {
        requests: s.requests,
        success: s.success,
        error: s.error,
        timeout: s.timeout,
        retries: s.retries,
        cacheHits: s.cacheHits,
        successRate: s.requests > 0 ? Number((s.success / s.requests).toFixed(4)) : null,
        durationMs: {
          avg: sorted.length ? Math.round(sum / sorted.length) : null,
          min: sorted.length ? Math.round(sorted[0]) : null,
          max: sorted.length ? Math.round(sorted[sorted.length - 1]) : null,
          p50: percentile(sorted, 50),
          p95: percentile(sorted, 95),
          p99: percentile(sorted, 99),
        },
        errorsByCode: s.errorsByCode,
        lastStatus: s.lastStatus,
        lastErrorCode: s.lastErrorCode,
        lastRequestAt: s.lastRequestAt,
      };
    }

    return { hosts, collectedAt: new Date().toISOString() };
  }

  reset() {
    this.byHost.clear();
  }
}

export const portalMetrics = new PortalMetrics();
