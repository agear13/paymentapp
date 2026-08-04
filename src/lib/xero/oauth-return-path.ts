/**
 * Allowed post-OAuth redirect targets for Xero connect flows.
 * Legacy dashboard integrations remains the default when no return path is set.
 */
const ALLOWED_XERO_OAUTH_RETURN_PREFIXES = [
  '/workspace/connected',
  '/dashboard/settings/integrations',
] as const;

export function normalizeXeroOAuthReturnPath(path: string | null | undefined): string | undefined {
  if (!path || typeof path !== 'string') return undefined;
  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return undefined;
  const pathname = trimmed.split('?')[0]?.split('#')[0] ?? '';
  const allowed = ALLOWED_XERO_OAUTH_RETURN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  return allowed ? pathname : undefined;
}
