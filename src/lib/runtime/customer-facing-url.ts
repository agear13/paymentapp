/**
 * Canonical customer-facing URL resolution for operational settlement flows.
 *
 * Priority:
 * 1. NEXT_PUBLIC_APP_URL (branded production domain)
 * 2. Server request origin (API routes / SSR)
 * 3. Client runtime origin
 * 4. localhost — development only, never production
 *
 * Infrastructure domains (*.onrender.com) are blocked by default.
 * Set ALLOW_INFRASTRUCTURE_DOMAINS=true for temporary staging on Render.
 */

import { logOperationalError } from '@/lib/operational/log-operational-error';

export const CUSTOMER_FACING_MISCONFIG_MESSAGE =
  'Customer-facing domain is not configured correctly.';

export type CustomerFacingOriginSource = 'env' | 'request' | 'runtime' | 'development';

export type CustomerFacingDomainEvaluation = {
  hostname: string | null;
  accepted: boolean;
  reason: string;
  infrastructureOverride: boolean;
  isLoopback: boolean;
  isInfrastructure: boolean;
};

export type CustomerFacingOriginResolution =
  | {
      configured: true;
      origin: string;
      source: CustomerFacingOriginSource;
      infrastructureOverride: boolean;
    }
  | {
      configured: false;
      origin: null;
      source: 'missing';
      message: string;
      infrastructureOverride: boolean;
    };

function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}

function isDevelopmentEnvironment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/** Centralized staging override — server runtime and build-time env. */
export function isInfrastructureDomainAllowed(): boolean {
  return process.env.ALLOW_INFRASTRUCTURE_DOMAINS === 'true';
}

function infrastructureDomainsPermitted(explicitOverride?: boolean): boolean {
  if (explicitOverride === true) return true;
  return isInfrastructureDomainAllowed();
}

function hostnameFromOrigin(originOrUrl: string): string | null {
  try {
    return new URL(originOrUrl).hostname;
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname: string): boolean {
  return /^localhost$/i.test(hostname) || hostname === '127.0.0.1';
}

function isInfrastructureHost(hostname: string): boolean {
  return /\.onrender\.com$/i.test(hostname) || /^onrender\.com$/i.test(hostname);
}

export function evaluateCustomerFacingDomain(
  originOrUrl: string,
  options?: { infrastructureOverride?: boolean }
): CustomerFacingDomainEvaluation {
  const infrastructureOverride = infrastructureDomainsPermitted(options?.infrastructureOverride);
  const hostname = hostnameFromOrigin(originOrUrl);

  if (!hostname) {
    return {
      hostname: null,
      accepted: false,
      reason: 'invalid_url',
      infrastructureOverride,
      isLoopback: false,
      isInfrastructure: false,
    };
  }

  const loopback = isLoopbackHost(hostname);
  const infrastructure = isInfrastructureHost(hostname);

  if (loopback) {
    if (isProductionEnvironment()) {
      return {
        hostname,
        accepted: false,
        reason: 'loopback_blocked_in_production',
        infrastructureOverride,
        isLoopback: true,
        isInfrastructure: infrastructure,
      };
    }
    return {
      hostname,
      accepted: true,
      reason: 'loopback_allowed_in_development',
      infrastructureOverride,
      isLoopback: true,
      isInfrastructure: infrastructure,
    };
  }

  if (infrastructure) {
    if (infrastructureOverride) {
      return {
        hostname,
        accepted: true,
        reason: 'infrastructure_allowed_by_override',
        infrastructureOverride: true,
        isLoopback: false,
        isInfrastructure: true,
      };
    }
    return {
      hostname,
      accepted: false,
      reason: 'infrastructure_blocked',
      infrastructureOverride: false,
      isLoopback: false,
      isInfrastructure: true,
    };
  }

  return {
    hostname,
    accepted: true,
    reason: 'branded_domain',
    infrastructureOverride,
    isLoopback: false,
    isInfrastructure: false,
  };
}

export function isInvalidCustomerHost(
  originOrUrl: string,
  options?: { infrastructureOverride?: boolean }
): boolean {
  return !evaluateCustomerFacingDomain(originOrUrl, options).accepted;
}

export type CustomerFacingUrlOptions = {
  origin?: string;
  requestOrigin?: string;
  runtimeOrigin?: string;
  /** Server-provided override for client bundles without runtime env access. */
  infrastructureOverride?: boolean;
};

function logCustomerFacingDomainEvaluation(
  context: string,
  candidate: string,
  evaluation: CustomerFacingDomainEvaluation
): void {
  const payload = {
    context,
    candidate,
    overrideEnabled: evaluation.infrastructureOverride,
    hostname: evaluation.hostname,
    accepted: evaluation.accepted,
    reason: evaluation.reason,
    isLoopback: evaluation.isLoopback,
    isInfrastructure: evaluation.isInfrastructure,
  };

  if (evaluation.accepted) {
    if (evaluation.isInfrastructure && evaluation.infrastructureOverride) {
      console.info('[CustomerFacingDomain]', payload);
    }
    return;
  }

  if (isProductionEnvironment()) {
    logOperationalError(new Error(`Customer-facing domain rejected: ${evaluation.reason}`), {
      component: context,
      route: candidate,
    });
  } else {
    console.warn('[CustomerFacingDomain]', payload);
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

function readConfiguredEnvOrigin(options?: { infrastructureOverride?: boolean }): string | null {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!envUrl) return null;
  const normalized = normalizeOrigin(envUrl);
  if (!normalized) return null;

  const evaluation = evaluateCustomerFacingDomain(normalized, options);
  logCustomerFacingDomainEvaluation('readConfiguredEnvOrigin', normalized, evaluation);
  if (!evaluation.accepted) return null;
  return normalized;
}

function resolveFromCandidate(
  candidate: string | undefined,
  source: CustomerFacingOriginSource,
  context: string,
  options?: { infrastructureOverride?: boolean }
): CustomerFacingOriginResolution | null {
  if (!candidate) return null;

  const normalized = normalizeOrigin(candidate);
  if (!normalized) return null;

  const evaluation = evaluateCustomerFacingDomain(normalized, options);
  logCustomerFacingDomainEvaluation(context, normalized, evaluation);

  if (!evaluation.accepted) return null;

  return {
    configured: true,
    origin: normalized,
    source,
    infrastructureOverride: evaluation.isInfrastructure && evaluation.infrastructureOverride,
  };
}

export function resolveCustomerFacingOrigin(options?: CustomerFacingUrlOptions): CustomerFacingOriginResolution {
  const overrideEnabled = infrastructureDomainsPermitted(options?.infrastructureOverride);

  const envOrigin = readConfiguredEnvOrigin(options);
  if (envOrigin) {
    const evaluation = evaluateCustomerFacingDomain(envOrigin, options);
    return {
      configured: true,
      origin: envOrigin,
      source: 'env',
      infrastructureOverride: evaluation.isInfrastructure && evaluation.infrastructureOverride,
    };
  }

  const fromRequest = resolveFromCandidate(
    options?.requestOrigin,
    'request',
    'resolveCustomerFacingOrigin.requestOrigin',
    options
  );
  if (fromRequest) return fromRequest;

  const fromRuntime = resolveFromCandidate(
    options?.runtimeOrigin,
    'runtime',
    'resolveCustomerFacingOrigin.runtimeOrigin',
    options
  );
  if (fromRuntime) return fromRuntime;

  if (isDevelopmentEnvironment()) {
    return {
      configured: true,
      origin: 'http://localhost:3000',
      source: 'development',
      infrastructureOverride: false,
    };
  }

  return {
    configured: false,
    origin: null,
    source: 'missing',
    message: CUSTOMER_FACING_MISCONFIG_MESSAGE,
    infrastructureOverride: overrideEnabled,
  };
}

export function getBrandedAppOrigin(
  requestOrigin?: string,
  options?: Pick<CustomerFacingUrlOptions, 'infrastructureOverride'>
): string {
  const resolution = resolveCustomerFacingOrigin({
    requestOrigin,
    infrastructureOverride: options?.infrastructureOverride,
  });
  if (resolution.configured) return resolution.origin;
  if (isDevelopmentEnvironment()) return 'http://localhost:3000';
  throw new Error(resolution.message);
}

export function getClientBrandedOrigin(
  runtimeOrigin?: string,
  options?: Pick<CustomerFacingUrlOptions, 'infrastructureOverride'>
): string {
  const resolution = resolveCustomerFacingOrigin({
    runtimeOrigin:
      runtimeOrigin ??
      (typeof window !== 'undefined' ? window.location.origin : undefined),
    infrastructureOverride: options?.infrastructureOverride,
  });
  if (resolution.configured) return resolution.origin;
  if (isDevelopmentEnvironment()) return 'http://localhost:3000';
  return '';
}

export function buildCustomerFacingUrl(path: string, options?: CustomerFacingUrlOptions): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (options?.origin) {
    const base = normalizeOrigin(options.origin);
    if (base && !isInvalidCustomerHost(base, options)) {
      return `${base}${normalizedPath}`.replace(/([^:]\/)\/+/g, '$1');
    }
  }

  const resolution = resolveCustomerFacingOrigin({
    requestOrigin: options?.requestOrigin,
    runtimeOrigin:
      options?.runtimeOrigin ??
      (typeof window !== 'undefined' ? window.location.origin : undefined),
    infrastructureOverride: options?.infrastructureOverride,
  });

  if (!resolution.configured) {
    if (isDevelopmentEnvironment()) {
      return `http://localhost:3000${normalizedPath}`;
    }
    throw new Error(resolution.message);
  }

  return `${resolution.origin}${normalizedPath}`.replace(/([^:]\/)\/+/g, '$1');
}

export function getPaymentLinkUrl(shortCode: string, options?: CustomerFacingUrlOptions): string {
  return buildCustomerFacingUrl(`/pay/${encodeURIComponent(shortCode)}`, options);
}

export function validateCustomerFacingConfiguration(options?: CustomerFacingUrlOptions): {
  ok: boolean;
  message?: string;
  origin?: string;
  infrastructureOverride: boolean;
} {
  const resolution = resolveCustomerFacingOrigin(options);
  if (resolution.configured) {
    return {
      ok: true,
      origin: resolution.origin,
      infrastructureOverride: resolution.infrastructureOverride,
    };
  }
  return {
    ok: false,
    message: resolution.message,
    infrastructureOverride: resolution.infrastructureOverride,
  };
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

/** @deprecated Use evaluateCustomerFacingDomain / isInvalidCustomerHost. */
export function isValidCustomerFacingOrigin(originOrUrl: string): boolean {
  return !isInvalidCustomerHost(originOrUrl);
}

/** @deprecated Alias for validateCustomerFacingConfiguration. */
export function validateCustomerFacingDomain(options?: CustomerFacingUrlOptions) {
  return validateCustomerFacingConfiguration(options);
}
