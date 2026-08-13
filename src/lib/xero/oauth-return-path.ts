import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

/**
 * Allowed post-OAuth redirect targets for Xero connect flows.
 * Legacy dashboard integrations remains the fallback when no return path is set.
 */
const ALLOWED_XERO_OAUTH_RETURN_PREFIXES = [
  '/workspace',
  '/dashboard/settings/integrations',
] as const;

const LEGACY_XERO_OAUTH_DEFAULT_PATH = '/dashboard/settings/integrations';

export function isAllowedXeroOAuthReturnPath(pathname: string): boolean {
  return ALLOWED_XERO_OAUTH_RETURN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function normalizeXeroOAuthReturnPath(path: string | null | undefined): string | undefined {
  if (!path || typeof path !== 'string') return undefined;
  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return undefined;
  const pathname = trimmed.split('?')[0]?.split('#')[0] ?? '';
  return isAllowedXeroOAuthReturnPath(pathname) ? pathname : undefined;
}

/** Canonical post-OAuth destination for Commercial OS accounting setup. */
export function commercialOsXeroOAuthReturnPath(): string {
  return COMMERCIAL_OS_ROUTES.connectedXero;
}

/** Fallback when OAuth state does not include a valid return path. */
export function legacyXeroOAuthDefaultReturnPath(): string {
  return LEGACY_XERO_OAUTH_DEFAULT_PATH;
}

export function resolveXeroOAuthReturnPath(returnPath?: string | null): string {
  return (
    normalizeXeroOAuthReturnPath(returnPath) ??
    legacyXeroOAuthDefaultReturnPath()
  );
}
