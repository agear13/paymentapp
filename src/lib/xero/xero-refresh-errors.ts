export type XeroRefreshFailureCategory =
  | 'invalid_grant'
  | 'transient'
  | 'persist_failed'
  | 'unclassified';

export type XeroRefreshFailureClassification = {
  category: XeroRefreshFailureCategory;
  statusCode?: number;
  providerError?: string | null;
  message: string;
};

export type XeroRefreshFailureDiagnostics = {
  category: XeroRefreshFailureCategory;
  statusCode: number | null;
  providerError: string | null;
  message: string;
};

const INVALID_GRANT_PATTERN = /invalid[_\s-]?grant|invalid refresh token|unauthorized/i;
const TRANSIENT_NETWORK_PATTERN =
  /econnreset|etimedout|enotfound|eai_again|econnrefused|socket hang up|network|fetch failed|temporarily unavailable|timeout/i;
const PERSIST_FAILURE_PATTERN = /persist|database|prisma/i;
const PROVIDER_ERROR_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
const SANITIZE_PATTERNS: Array<[RegExp, string]> = [
  [/bearer\s+[A-Za-z0-9._\-+=\/]+/gi, 'Bearer [redacted]'],
  [/access_token["']?\s*[:=]\s*["']?[^\s"'&,}]+/gi, 'access_token=[redacted]'],
  [/refresh_token["']?\s*[:=]\s*["']?[^\s"'&,}]+/gi, 'refresh_token=[redacted]'],
  [/client_secret["']?\s*[:=]\s*["']?[^\s"'&,}]+/gi, 'client_secret=[redacted]'],
  [/authorization["']?\s*[:=]\s*["']?[^\s"'&,}]+/gi, 'authorization=[redacted]'],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-jwt]'],
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function asFiniteStatus(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asProviderErrorCode(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return PROVIDER_ERROR_PATTERN.test(trimmed) ? trimmed : undefined;
}

function nestedRecord(value: unknown, key: string): Record<string, unknown> | null {
  return asRecord(asRecord(value)?.[key]);
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return undefined;
}

export function extractXeroRefreshMessage(error: unknown): string {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  const record = asRecord(error);
  const response = asRecord(record?.response);
  const data = asRecord(response?.data) ?? nestedRecord(record, 'data');
  const body = asRecord(response?.body) ?? nestedRecord(record, 'body');
  const genericHttpMessage =
    firstString(error instanceof Error ? error.message : undefined, record?.message);
  const oauthDescription = firstString(
    record?.error_description,
    data?.error_description,
    data?.message,
    body?.error_description,
    body?.Message,
    body?.message
  );

  if (oauthDescription) {
    return oauthDescription;
  }

  if (genericHttpMessage) {
    return genericHttpMessage;
  }

  return 'Unknown Xero refresh failure';
}

function isPrismaLikeError(error: unknown): boolean {
  const name =
    error instanceof Error
      ? error.name
      : typeof asRecord(error)?.name === 'string'
        ? String(asRecord(error)?.name)
        : '';
  return name.startsWith('PrismaClient');
}

export function sanitizeXeroRefreshMessage(raw: string): string {
  let sanitized = raw.trim();

  for (const [pattern, replacement] of SANITIZE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  if (sanitized.length > 300) {
    return `${sanitized.slice(0, 300)}…`;
  }

  return sanitized;
}

export function extractXeroRefreshStatusCode(error: unknown): number | undefined {
  const record = asRecord(error);
  if (!record) {
    return undefined;
  }

  const response = asRecord(record.response);
  return (
    asFiniteStatus(record.statusCode) ??
    asFiniteStatus(record.status) ??
    asFiniteStatus(response?.statusCode) ??
    asFiniteStatus(response?.status)
  );
}

export function extractXeroProviderError(error: unknown): string | null {
  const record = asRecord(error);
  if (!record) {
    return asProviderErrorCode(error) ?? null;
  }

  const response = asRecord(record.response);
  const data = asRecord(response?.data) ?? nestedRecord(record, 'data');
  const body = asRecord(response?.body) ?? nestedRecord(record, 'body');

  return (
    asProviderErrorCode(record.error) ??
    asProviderErrorCode(data?.error) ??
    asProviderErrorCode(body?.error) ??
    asProviderErrorCode(record.error_code) ??
    asProviderErrorCode(body?.ErrorNumber) ??
    asProviderErrorCode(record.code) ??
    asProviderErrorCode(extractXeroRefreshMessage(error)) ??
    null
  );
}

export function toXeroRefreshFailureDiagnostics(
  classified: XeroRefreshFailureClassification
): XeroRefreshFailureDiagnostics {
  return {
    category: classified.category,
    statusCode: classified.statusCode ?? null,
    providerError: classified.providerError ?? null,
    message: sanitizeXeroRefreshMessage(classified.message),
  };
}

export class XeroRefreshError extends Error {
  readonly category: XeroRefreshFailureCategory;
  readonly statusCode?: number;
  readonly providerError?: string | null;

  constructor(
    message: string,
    category: XeroRefreshFailureCategory,
    statusCode?: number,
    providerError?: string | null
  ) {
    super(sanitizeXeroRefreshMessage(message));
    this.name = 'XeroRefreshError';
    this.category = category;
    this.statusCode = statusCode;
    this.providerError = providerError ?? null;
  }
}

export function classifyXeroRefreshFailure(error: unknown): XeroRefreshFailureClassification {
  if (error instanceof XeroRefreshError) {
    return {
      category: error.category,
      statusCode: error.statusCode,
      providerError: error.providerError ?? extractXeroProviderError(error),
      message: sanitizeXeroRefreshMessage(error.message),
    };
  }

  const message = extractXeroRefreshMessage(error);
  const sanitizedMessage = sanitizeXeroRefreshMessage(message);
  const statusCode = extractXeroRefreshStatusCode(error);
  const providerError = extractXeroProviderError(error);

  if (statusCode === 400 || statusCode === 401 || INVALID_GRANT_PATTERN.test(message)) {
    return {
      category: 'invalid_grant',
      statusCode,
      providerError,
      message: sanitizedMessage,
    };
  }

  if (isPrismaLikeError(error) || PERSIST_FAILURE_PATTERN.test(message)) {
    return {
      category: 'persist_failed',
      statusCode,
      providerError,
      message: sanitizedMessage,
    };
  }

  if (
    statusCode === 429 ||
    (typeof statusCode === 'number' && statusCode >= 500) ||
    TRANSIENT_NETWORK_PATTERN.test(message)
  ) {
    return {
      category: 'transient',
      statusCode,
      providerError,
      message: sanitizedMessage,
    };
  }

  return {
    category: 'unclassified',
    statusCode,
    providerError,
    message: sanitizedMessage,
  };
}

export function xeroRefreshErrorFromUnknown(error: unknown): XeroRefreshError {
  const classified = classifyXeroRefreshFailure(error);
  return new XeroRefreshError(
    classified.message,
    classified.category,
    classified.statusCode,
    classified.providerError
  );
}
