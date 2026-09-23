import dns from 'dns/promises';
import net from 'net';
import tls from 'tls';
import { env } from '../../config/env';
import { portalHttp } from './portal-http-client';
import { PortalError, PortalErrorCode, codeFromNetworkError } from './portal-error';

export interface PhaseResult {
  ok: boolean;
  durationMs: number;
  detail?: string;
  error?: string;
  errorCode?: PortalErrorCode;
}

export interface PortalDiagnostics {
  url: string;
  host: string;
  port: number;
  protocol: string;
  reachable: boolean;
  errorCode?: PortalErrorCode;
  errorMessage?: string;
  phases: {
    dns: PhaseResult;
    tcp: PhaseResult;
    tls?: PhaseResult;
    http: PhaseResult;
  };
  totalDurationMs: number;
  checkedAt: string;
}

export async function diagnosePortal(rawUrl: string): Promise<PortalDiagnostics> {
  const started = performance.now();

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return {
      url: rawUrl,
      host: '',
      port: 0,
      protocol: '',
      reachable: false,
      errorCode: 'INVALID_RESPONSE',
      errorMessage: `URL inválida: ${rawUrl}`,
      phases: {
        dns: skipped('URL inválida'),
        tcp: skipped('URL inválida'),
        http: skipped('URL inválida'),
      },
      totalDurationMs: 0,
      checkedAt: new Date().toISOString(),
    };
  }

  const isHttps = parsed.protocol === 'https:';
  const port = parsed.port ? Number.parseInt(parsed.port, 10) : isHttps ? 443 : 80;

  const dnsResult = await measureDns(parsed.hostname);
  if (!dnsResult.ok) {
    return finish(rawUrl, parsed, port, started, {
      dns: dnsResult,
      tcp: skipped('DNS falhou'),
      ...(isHttps ? { tls: skipped('DNS falhou') } : {}),
      http: skipped('DNS falhou'),
    });
  }

  const tcpResult = await measureTcp(parsed.hostname, port);
  if (!tcpResult.ok) {
    return finish(rawUrl, parsed, port, started, {
      dns: dnsResult,
      tcp: tcpResult,
      ...(isHttps ? { tls: skipped('TCP falhou') } : {}),
      http: skipped('TCP falhou'),
    });
  }

  const tlsResult = isHttps ? await measureTls(parsed.hostname, port) : undefined;
  if (tlsResult && !tlsResult.ok) {
    return finish(rawUrl, parsed, port, started, {
      dns: dnsResult,
      tcp: tcpResult,
      tls: tlsResult,
      http: skipped('TLS falhou'),
    });
  }

  const httpResult = await measureHttp(rawUrl);

  return finish(rawUrl, parsed, port, started, {
    dns: dnsResult,
    tcp: tcpResult,
    ...(tlsResult ? { tls: tlsResult } : {}),
    http: httpResult,
  });
}

async function measureDns(hostname: string): Promise<PhaseResult> {
  const start = performance.now();
  try {
    const addresses = await withTimeout(
      dns.lookup(hostname, { all: true }),
      env.portal.connectTimeoutMs,
      'DNS'
    );
    return {
      ok: true,
      durationMs: round(performance.now() - start),
      detail: addresses.map((a) => a.address).join(', '),
    };
  } catch (err) {
    return {
      ok: false,
      durationMs: round(performance.now() - start),
      errorCode: codeFromNetworkError(err),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function measureTcp(hostname: string, port: number): Promise<PhaseResult> {
  const start = performance.now();

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const done = (result: PhaseResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(env.portal.connectTimeoutMs);

    socket.once('connect', () =>
      done({ ok: true, durationMs: round(performance.now() - start), detail: `${hostname}:${port}` })
    );

    socket.once('timeout', () =>
      done({
        ok: false,
        durationMs: round(performance.now() - start),
        errorCode: 'TIMEOUT',
        error: `Conexão TCP não completou em ${env.portal.connectTimeoutMs}ms`,
      })
    );

    socket.once('error', (err) =>
      done({
        ok: false,
        durationMs: round(performance.now() - start),
        errorCode: codeFromNetworkError(err),
        error: err.message,
      })
    );

    socket.connect(port, hostname);
  });
}

function measureTls(hostname: string, port: number): Promise<PhaseResult> {
  const start = performance.now();

  return new Promise((resolve) => {
    let settled = false;

    const socket = tls.connect(
      { host: hostname, port, servername: hostname, timeout: env.portal.connectTimeoutMs },
      () => {
        if (settled) return;
        settled = true;
        const cert = socket.getPeerCertificate();
        const protocol = socket.getProtocol();
        socket.destroy();
        resolve({
          ok: true,
          durationMs: round(performance.now() - start),
          detail: `${protocol ?? 'TLS'}${cert?.valid_to ? `, cert válido até ${cert.valid_to}` : ''}`,
        });
      }
    );

    const fail = (err: unknown, code?: PortalErrorCode) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({
        ok: false,
        durationMs: round(performance.now() - start),
        errorCode: code ?? codeFromNetworkError(err),
        error: err instanceof Error ? err.message : String(err),
      });
    };

    socket.once('timeout', () =>
      fail(new Error(`Handshake TLS não completou em ${env.portal.connectTimeoutMs}ms`), 'TIMEOUT')
    );
    socket.once('error', (err) => fail(err));
  });
}

async function measureHttp(url: string): Promise<PhaseResult> {
  const start = performance.now();
  try {
    const response = await portalHttp.get({
      portal: 'diagnostics',
      url,
      maxRetries: 0,
      cacheTtlSeconds: 0,
    });

    const contentType = detectContentType(response.data);

    return {
      ok: true,
      durationMs: round(response.durationMs),
      detail: `HTTP ${response.status}, ${Buffer.byteLength(response.data)} bytes, ${contentType}`,
    };
  } catch (err) {
    if (err instanceof PortalError) {
      return {
        ok: false,
        durationMs: round(err.durationMs),
        errorCode: err.code,
        error: err.message,
      };
    }
    return {
      ok: false,
      durationMs: round(performance.now() - start),
      errorCode: codeFromNetworkError(err),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function detectContentType(body: string): string {
  const head = body.slice(0, 400).toLowerCase();
  if (head.includes('<!doctype html') || head.includes('<html')) return 'html';
  const trimmed = body.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (head.includes('<?xml')) return 'xml';
  return 'desconhecido';
}

function skipped(reason: string): PhaseResult {
  return { ok: false, durationMs: 0, detail: `não executado: ${reason}` };
}

function round(ms: number): number {
  return Math.round(ms);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error(`${label} excedeu ${ms}ms`), { code: 'ETIMEDOUT' })), ms)
    ),
  ]);
}

function finish(
  url: string,
  parsed: URL,
  port: number,
  started: number,
  phases: PortalDiagnostics['phases']
): PortalDiagnostics {
  const failed = [phases.dns, phases.tcp, phases.tls, phases.http].find(
    (p): p is PhaseResult => !!p && !p.ok
  );

  return {
    url,
    host: parsed.hostname,
    port,
    protocol: parsed.protocol.replace(':', ''),
    reachable: !failed,
    errorCode: failed?.errorCode,
    errorMessage: failed?.error ?? failed?.detail,
    phases,
    totalDurationMs: round(performance.now() - started),
    checkedAt: new Date().toISOString(),
  };
}
