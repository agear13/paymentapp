/**
 * Canonical customer-facing URL resolution for operational settlement flows.
 *
 * Branded payment-link origins (`resolveCustomerFacingOrigin` / `getBrandedAppOrigin`):
 * 1. NEXT_PUBLIC_APP_URL (branded production domain)
 * 2. Server request origin (API routes / SSR)
 * 3. Client runtime origin
 * 4. localhost — development only, never production
 *
 * Current-deployment origins (`resolveCanonicalPublicOrigin`) for participant
 * invitations, auth return URLs, and other same-app links:
 * 1. Trusted public request origin (forwarded host only behind known proxies)
 * 2. NEXT_PUBLIC_APP_URL when the request origin is loopback/invalid
 * 3. Platform public URL (RENDER_EXTERNAL_URL / VERCEL_URL)
 * 4. localhost — development only, never production
 *
 * Infrastructure domains (*.onrender.com) are blocked by default for branded
 * customer links. Set ALLOW_INFRASTRUCTURE_DOMAINS=true for temporary staging
 * on Render. Participant/current-deployment links may use the live request host
 * (including onrender) so preview/staging do not emit the production domain.
 */

import { logOperationalError } from '@/lib/operational/log-operational-error';

export const CUSTOMER_FACING_MISCONFIG_MESSAGE =
  'Customer-facing domain is not configured correctly.';

export type CustomerFacingOriginSource = 'env' | 'request' | 'runtime' | 'development' | 'platform';

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

/**
 * Safe origin for SSR / customer pages — never throws.
 */
export function getBrandedAppOriginSafe(
  requestOrigin?: string,
  options?: Pick<CustomerFacingUrlOptions, 'infrastructureOverride'>
): string | null {
  const resolution = resolveCustomerFacingOrigin({
    requestOrigin,
    infrastructureOverride: options?.infrastructureOverride,
  });
  if (resolution.configured) return resolution.origin;
  if (isDevelopmentEnvironment()) return 'http://localhost:3000';
  return null;
}

/**
 * Public app base URL for links and branding — never throws during render.
 */
export function getPublicAppUrl(
  requestOrigin?: string,
  options?: Pick<CustomerFacingUrlOptions, 'infrastructureOverride'>
): string {
  const safe = getBrandedAppOriginSafe(requestOrigin, options);
  if (safe) return safe;
  if (requestOrigin?.trim()) {
    const normalized = normalizeOrigin(requestOrigin);
    if (normalized) return normalized;
  }
  return '';
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

function firstHeaderValue(value: string | null | undefined): string {
  return value?.split(',')[0]?.trim() ?? '';
}

function stripProtocolColon(protocol: string | undefined): string {
  return (protocol ?? '').trim().replace(/:$/, '').toLowerCase();
}

function isAllowedForwardedProto(proto: string): proto is 'http' | 'https' {
  return proto === 'http' || proto === 'https';
}

function isSafeHostHeader(host: string): boolean {
  if (!host || /[\s/\\@]/.test(host) || host.includes('://')) return false;
  try {
    return Boolean(new URL(`https://${host}`).hostname);
  } catch {
    return false;
  }
}

/**
 * Platforms that overwrite X-Forwarded-* at the edge. Do not trust client-supplied
 * forwarded host/origin headers unless this is true (or TRUST_PROXY=true).
 */
export function isTrustedForwardedOriginEnvironment(): boolean {
  return (
    process.env.VERCEL === '1' ||
    Boolean(process.env.VERCEL_ENV) ||
    process.env.RENDER === 'true' ||
    Boolean(process.env.RENDER_EXTERNAL_URL) ||
    Boolean(process.env.RENDER_EXTERNAL_HOSTNAME) ||
    process.env.TRUST_PROXY === 'true'
  );
}

function readPlatformPublicOrigin(): string | null {
  const renderUrl = process.env.RENDER_EXTERNAL_URL?.trim();
  const fromRender = resolveFromCandidate(
    renderUrl,
    'platform',
    'readPlatformPublicOrigin.RENDER_EXTERNAL_URL',
    { infrastructureOverride: true }
  );
  if (fromRender?.configured) return fromRender.origin;

  const vercelHost = process.env.VERCEL_URL?.trim();
  if (!vercelHost) return null;
  const vercelUrl = vercelHost.includes('://') ? vercelHost : `https://${vercelHost}`;
  const fromVercel = resolveFromCandidate(
    vercelUrl,
    'platform',
    'readPlatformPublicOrigin.VERCEL_URL',
    { infrastructureOverride: true }
  );
  return fromVercel?.configured ? fromVercel.origin : null;
}

/**
 * Public origin when no request is available (jobs, fallbacks).
 * Never returns localhost in production.
 */
export function resolveConfiguredPublicOrigin(): string {
  const envOrigin = readConfiguredEnvOrigin();
  if (envOrigin) return envOrigin;

  const platform = readPlatformPublicOrigin();
  if (platform) return platform;

  if (isDevelopmentEnvironment()) return 'http://localhost:3000';
  return '';
}

/**
 * Current public origin for this deployment. Prefers the live request host so
 * preview/staging links stay on that environment instead of production env.
 * Loopback (including Render's internal https://localhost:10000) is rejected
 * in production.
 */
export function resolveCanonicalPublicOrigin(request: {
  nextUrl: { origin: string; protocol: string };
  headers: { get(name: string): string | null };
}): string {
  const requestOrigin = resolveRequestOrigin(request);
  const fromRequest = resolveFromCandidate(
    requestOrigin,
    'request',
    'resolveCanonicalPublicOrigin.requestOrigin',
    { infrastructureOverride: isTrustedForwardedOriginEnvironment() }
  );
  if (fromRequest?.configured) return fromRequest.origin;

  const configured = resolveConfiguredPublicOrigin();
  if (configured) return configured;

  if (isDevelopmentEnvironment() && requestOrigin) {
    const normalized = normalizeOrigin(requestOrigin);
    if (normalized) return normalized;
  }

  return getPublicAppUrl(requestOrigin);
}

/**
 * Sanitize an explicit origin used when building participant/workspace links.
 * Callers that still pass `request.nextUrl.origin` (localhost:10000 on Render)
 * fall back to the configured public origin in production.
 */
export function resolveParticipantLinkOrigin(explicitOrigin?: string): string {
  if (explicitOrigin?.trim()) {
    const fromExplicit = resolveFromCandidate(
      explicitOrigin,
      'request',
      'resolveParticipantLinkOrigin.explicit',
      { infrastructureOverride: true }
    );
    if (fromExplicit?.configured) return fromExplicit.origin;
  }

  if (typeof window !== 'undefined') {
    const runtimeOrigin = window.location.origin;
    const fromRuntime = resolveFromCandidate(
      runtimeOrigin,
      'runtime',
      'resolveParticipantLinkOrigin.runtime',
      { infrastructureOverride: true }
    );
    if (fromRuntime?.configured) return fromRuntime.origin;
    if (!isProductionEnvironment()) return runtimeOrigin;
  }

  return resolveConfiguredPublicOrigin();
}

export type PublicOriginRequest = {
  nextUrl: { origin: string; protocol: string };
  headers: { get(name: string): string | null };
};

function originFromHostAndProto(host: string, proto: string): string | undefined {
  if (!isSafeHostHeader(host)) return undefined;
  const candidate = `${proto}://${host}`;
  const hostname = hostnameFromOrigin(candidate);
  if (!hostname) return undefined;
  if (isProductionEnvironment() && isLoopbackHost(hostname)) return undefined;
  return candidate;
}

function forwardedHeaderHost(request: PublicOriginRequest): string {
  const rfcForwarded = firstHeaderValue(request.headers.get('forwarded'));
  const rfcHost = rfcForwarded.match(/(?:^|;|\s)host=([^;]+)/i)?.[1]?.trim().replace(/^"|"$/g, '');
  return firstHeaderValue(rfcHost) || firstHeaderValue(request.headers.get('x-forwarded-host'));
}

export function resolveRequestOrigin(request: PublicOriginRequest): string | undefined {
  const forwardedHost = forwardedHeaderHost(request);
  const forwardedProto = stripProtocolColon(firstHeaderValue(request.headers.get('x-forwarded-proto')));
  const trustForwarded = isTrustedForwardedOriginEnvironment();
  const fallbackProto =
    stripProtocolColon(request.nextUrl.protocol) || (isProductionEnvironment() ? 'https' : 'http');

  if (trustForwarded && forwardedHost) {
    const proto = isAllowedForwardedProto(forwardedProto) ? forwardedProto : fallbackProto;
    const fromForwarded = originFromHostAndProto(forwardedHost, proto);
    if (fromForwarded) return fromForwarded;
  }

  const host = firstHeaderValue(request.headers.get('host'));
  const fromHost = originFromHostAndProto(host, fallbackProto);
  if (fromHost) return fromHost;

  const nextOrigin = request.nextUrl.origin || undefined;
  if (nextOrigin && isProductionEnvironment() && isLoopbackOriginValue(nextOrigin)) {
    return undefined;
  }
  return nextOrigin;
}

function isLoopbackOriginValue(origin: string): boolean {
  const hostname = hostnameFromOrigin(origin);
  return Boolean(hostname && isLoopbackHost(hostname));
}

function registrableHost(hostname: string): string {
  return hostname.replace(/^www\./i, '').toLowerCase();
}

function isSameRegistrableSite(originA: string, originB: string): boolean {
  const a = hostnameFromOrigin(originA);
  const b = hostnameFromOrigin(originB);
  if (!a || !b) return false;
  return registrableHost(a) === registrableHost(b);
}

function isCanonicalProvvypayHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'provvypay.com' || host === 'www.provvypay.com';
}

function readBrowserOriginHeader(request: PublicOriginRequest): string | null {
  const origin = normalizeOrigin(request.headers.get('origin') ?? '');
  if (!origin || isLoopbackOriginValue(origin)) return null;
  return origin;
}

function isAllowedBrowserAuthOrigin(origin: string, request: PublicOriginRequest): boolean {
  if (isLoopbackOriginValue(origin)) return false;
  const hostname = hostnameFromOrigin(origin);
  if (hostname && isCanonicalProvvypayHost(hostname)) return true;

  const envOrigin = readConfiguredEnvOrigin();
  if (envOrigin && (origin === envOrigin || isSameRegistrableSite(origin, envOrigin))) return true;

  const platform = readPlatformPublicOrigin();
  if (platform && origin === platform) return true;

  const forwarded = resolveRequestOrigin(request);
  const forwardedNormalized = forwarded ? normalizeOrigin(forwarded) : null;
  return Boolean(forwardedNormalized && origin === forwardedNormalized);
}

/**
 * Origin for PKCE magic-link `emailRedirectTo` and auth callback absolute URLs.
 * Must match the browser-visible host that stores the code-verifier cookie.
 * Never returns Render's internal localhost:10000 in production.
 */
export function resolveParticipantAuthOrigin(request: PublicOriginRequest): string {
  const browserOrigin = readBrowserOriginHeader(request);
  if (browserOrigin && isAllowedBrowserAuthOrigin(browserOrigin, request)) {
    return browserOrigin;
  }

  const envOrigin = readConfiguredEnvOrigin();
  const forwarded = resolveRequestOrigin(request);
  const forwardedNormalized = forwarded ? normalizeOrigin(forwarded) : null;
  const forwardedLoopback = Boolean(forwardedNormalized && isLoopbackOriginValue(forwardedNormalized));
  const forwardedHostName = forwardedNormalized ? hostnameFromOrigin(forwardedNormalized) : null;
  const forwardedInfra = Boolean(forwardedHostName && isInfrastructureHost(forwardedHostName));

  if (envOrigin && (!forwardedNormalized || forwardedLoopback || forwardedInfra)) {
    return envOrigin;
  }

  if (forwardedNormalized && !forwardedLoopback) {
    const accepted = resolveFromCandidate(
      forwardedNormalized,
      'request',
      'resolveParticipantAuthOrigin.forwarded',
      { infrastructureOverride: isTrustedForwardedOriginEnvironment() }
    );
    if (accepted?.configured) return accepted.origin;
  }

  if (envOrigin) return envOrigin;

  const configured = resolveConfiguredPublicOrigin();
  if (configured && !isLoopbackOriginValue(configured)) return configured;

  if (isDevelopmentEnvironment() && forwardedNormalized) return forwardedNormalized;
  return configured;
}

export function publicOriginRequestFromUrl(request: Request): PublicOriginRequest {
  const url = new URL(request.url);
  return {
    nextUrl: { origin: url.origin, protocol: url.protocol },
    headers: request.headers,
  };
}

/** Relative app path so the browser stays on the host it used to open the magic link. */
export function toAuthAppPath(path: string): string {
  if (!path.startsWith('/')) return `/${path}`;
  if (path.startsWith('//')) return '/';
  return path;
}

/** @deprecated Use evaluateCustomerFacingDomain / isInvalidCustomerHost. */
export function isValidCustomerFacingOrigin(originOrUrl: string): boolean {
  return !isInvalidCustomerHost(originOrUrl);
}

/** @deprecated Alias for validateCustomerFacingConfiguration. */
export function validateCustomerFacingDomain(options?: CustomerFacingUrlOptions) {
  return validateCustomerFacingConfiguration(options);
}
