/**
 * Canonical customer-facing URL resolution for operational settlement flows.
 *
 * Priority:
 * 1. NEXT_PUBLIC_APP_URL (branded production domain)
 * 2. Server request origin (API routes)
 * 3. Client runtime origin (non-infrastructure hosts only)
 * 4. localhost — development only, never production
 */

import { logOperationalError } from '@/lib/operational/log-operational-error';

export const CUSTOMER_FACING_MISCONFIG_MESSAGE =
  'Customer-facing domain is not configured correctly.';

const INVALID_CUSTOMER_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.0\.0\.1$/,
  /\.onrender\.com$/i,
  /^onrender\.com$/i,
];

export type CustomerFacingOriginSource = 'env' | 'request' | 'runtime' | 'development';

export type CustomerFacingOriginResolution =
  | {
      configured: true;
      origin: string;
      source: CustomerFacingOriginSource;
    }
  | {
      configured: false;
      origin: null;
      source: 'missing';
      message: string;
    };

function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}

function isDevelopmentEnvironment(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function isInvalidCustomerHost(originOrUrl: string): boolean {
  try {
    const hostname = new URL(originOrUrl).hostname;
    return INVALID_CUSTOMER_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
  } catch {
    return true;
  }
}

export function normalizeOrigin(origin: string): string | null {
  const trimmed = origin.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
      return `${parsed.protocol}//${parsed.host}`;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function readConfiguredEnvOrigin(): string | null {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!envUrl) return null;
  const normalized = normalizeOrigin(envUrl);
  if (!normalized || isInvalidCustomerHost(normalized)) return null;
  return normalized;
}

function logProductionLeakage(context: string, candidate: string): void {
  if (!isProductionEnvironment()) return;
  logOperationalError(new Error('Invalid customer-facing origin in production'), {
    component: context,
    route: candidate,
  });
}

export function resolveCustomerFacingOrigin(options?: {
  requestOrigin?: string;
  runtimeOrigin?: string;
}): CustomerFacingOriginResolution {
  const envOrigin = readConfiguredEnvOrigin();
  if (envOrigin) {
    return { configured: true, origin: envOrigin, source: 'env' };
  }

  if (options?.requestOrigin) {
    const normalized = normalizeOrigin(options.requestOrigin);
    if (normalized && !isInvalidCustomerHost(normalized)) {
      return { configured: true, origin: normalized, source: 'request' };
    }
    if (normalized && isProductionEnvironment()) {
      logProductionLeakage('resolveCustomerFacingOrigin.requestOrigin', normalized);
    }
  }

  if (options?.runtimeOrigin) {
    const normalized = normalizeOrigin(options.runtimeOrigin);
    if (normalized && !isInvalidCustomerHost(normalized)) {
      return { configured: true, origin: normalized, source: 'runtime' };
    }
    if (normalized && isProductionEnvironment()) {
      logProductionLeakage('resolveCustomerFacingOrigin.runtimeOrigin', normalized);
    }
  }

  if (isDevelopmentEnvironment()) {
    return {
      configured: true,
      origin: 'http://localhost:3000',
      source: 'development',
    };
  }

  return {
    configured: false,
    origin: null,
    source: 'missing',
    message: CUSTOMER_FACING_MISCONFIG_MESSAGE,
  };
}

export function getBrandedAppOrigin(requestOrigin?: string): string {
  const resolution = resolveCustomerFacingOrigin({ requestOrigin });
  if (resolution.configured) return resolution.origin;
  if (isDevelopmentEnvironment()) return 'http://localhost:3000';
  throw new Error(resolution.message);
}

export function getClientBrandedOrigin(runtimeOrigin?: string): string {
  const resolution = resolveCustomerFacingOrigin({
    runtimeOrigin:
      runtimeOrigin ??
      (typeof window !== 'undefined' ? window.location.origin : undefined),
  });
  if (resolution.configured) return resolution.origin;
  if (isDevelopmentEnvironment()) return 'http://localhost:3000';
  return '';
}

export function buildCustomerFacingUrl(
  path: string,
  options?: {
    origin?: string;
    requestOrigin?: string;
    runtimeOrigin?: string;
  }
): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (options?.origin) {
    const base = normalizeOrigin(options.origin);
    if (base && !isInvalidCustomerHost(base)) {
      return `${base}${normalizedPath}`.replace(/([^:]\/)\/+/g, '$1');
    }
  }

  const resolution = resolveCustomerFacingOrigin({
    requestOrigin: options?.requestOrigin,
    runtimeOrigin:
      options?.runtimeOrigin ??
      (typeof window !== 'undefined' ? window.location.origin : undefined),
  });

  if (!resolution.configured) {
    if (isDevelopmentEnvironment()) {
      return `http://localhost:3000${normalizedPath}`;
    }
    throw new Error(resolution.message);
  }

  return `${resolution.origin}${normalizedPath}`.replace(/([^:]\/)\/+/g, '$1');
}

export function getPaymentLinkUrl(
  shortCode: string,
  options?: {
    origin?: string;
    requestOrigin?: string;
    runtimeOrigin?: string;
  }
): string {
  return buildCustomerFacingUrl(`/pay/${encodeURIComponent(shortCode)}`, options);
}

export function validateCustomerFacingConfiguration(): {
  ok: boolean;
  message?: string;
  origin?: string;
} {
  const resolution = resolveCustomerFacingOrigin();
  if (resolution.configured) {
    return { ok: true, origin: resolution.origin };
  }
  return { ok: false, message: resolution.message };
}

export function resolveRequestOrigin(request: {
  nextUrl: { origin: string; protocol: string };
  headers: { get(name: string): string | null };
}): string | undefined {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.trim();
  const forwardedHost = request.headers.get('x-forwarded-host')?.trim();
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = request.headers.get('host')?.trim();
  if (host) {
    const protocol = request.nextUrl.protocol || 'https:';
    return `${protocol}//${host}`;
  }

  return request.nextUrl.origin;
}
