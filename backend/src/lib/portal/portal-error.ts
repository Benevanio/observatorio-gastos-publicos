export type PortalErrorCode =
  | 'DNS_ERROR'
  | 'CONNECTION_REFUSED'
  | 'CONNECTION_RESET'
  | 'TIMEOUT'
  | 'TLS_ERROR'
  | 'HTTP_400'
  | 'HTTP_401'
  | 'HTTP_403'
  | 'HTTP_404'
  | 'HTTP_408'
  | 'HTTP_429'
  | 'HTTP_500'
  | 'HTTP_502'
  | 'HTTP_503'
  | 'HTTP_504'
  | 'HTTP_ERROR'
  | 'RESPONSE_TOO_LARGE'
  | 'INVALID_RESPONSE'
  | 'ABORTED'
  | 'UNKNOWN';

const RETRYABLE: ReadonlySet<PortalErrorCode> = new Set<PortalErrorCode>([
  'DNS_ERROR',
  'CONNECTION_REFUSED',
  'CONNECTION_RESET',
  'TIMEOUT',
  'HTTP_408',
  'HTTP_429',
  'HTTP_500',
  'HTTP_502',
  'HTTP_503',
  'HTTP_504',
]);

export class PortalError extends Error {
  readonly code: PortalErrorCode;
  readonly portal: string;
  readonly endpoint: string;
  readonly httpStatus?: number;
  readonly durationMs: number;
  readonly attempt: number;
  readonly correlationId: string;
  readonly retryAfterMs?: number;

  constructor(params: {
    code: PortalErrorCode;
    message: string;
    portal: string;
    endpoint: string;
    httpStatus?: number;
    durationMs: number;
    attempt: number;
    correlationId: string;
    retryAfterMs?: number;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = 'PortalError';
    this.code = params.code;
    this.portal = params.portal;
    this.endpoint = params.endpoint;
    this.httpStatus = params.httpStatus;
    this.durationMs = params.durationMs;
    this.attempt = params.attempt;
    this.correlationId = params.correlationId;
    this.retryAfterMs = params.retryAfterMs;
    if (params.cause !== undefined) (this as { cause?: unknown }).cause = params.cause;
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.code);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      portal: this.portal,
      endpoint: this.endpoint,
      httpStatus: this.httpStatus,
      durationMs: Math.round(this.durationMs),
      attempt: this.attempt,
      correlationId: this.correlationId,
    };
  }
}

export function isRetryableCode(code: PortalErrorCode): boolean {
  return RETRYABLE.has(code);
}

export function codeFromHttpStatus(status: number): PortalErrorCode {
  switch (status) {
    case 400: return 'HTTP_400';
    case 401: return 'HTTP_401';
    case 403: return 'HTTP_403';
    case 404: return 'HTTP_404';
    case 408: return 'HTTP_408';
    case 429: return 'HTTP_429';
    case 500: return 'HTTP_500';
    case 502: return 'HTTP_502';
    case 503: return 'HTTP_503';
    case 504: return 'HTTP_504';
    default: return 'HTTP_ERROR';
  }
}

export function codeFromNetworkError(err: unknown): PortalErrorCode {
  const e = err as { code?: string; message?: string; name?: string };
  const sysCode = e?.code;

  switch (sysCode) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return 'DNS_ERROR';
    case 'ECONNREFUSED':
      return 'CONNECTION_REFUSED';
    case 'ECONNRESET':
    case 'EPIPE':
      return 'CONNECTION_RESET';
    case 'ETIMEDOUT':
    case 'ECONNABORTED':
    case 'ERR_CANCELED':
      return 'TIMEOUT';
    case 'EPROTO':
    case 'ERR_TLS_CERT_ALTNAME_INVALID':
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
    case 'CERT_HAS_EXPIRED':
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'SELF_SIGNED_CERT_IN_CHAIN':
      return 'TLS_ERROR';
    default:
      break;
  }

  if (e?.name === 'AbortError') return 'ABORTED';
  if (typeof e?.message === 'string' && /timeout/i.test(e.message)) return 'TIMEOUT';
  return 'UNKNOWN';
}
