/**
 * Edge-safe allowlist for Rabbit Hole / Strait minimal dashboard shells.
 * Keep in sync with pilot UX (sidebar + header links).
 */

export function normalizeMiddlewarePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

/** Paths pilots may visit (middleware gate). Prefix entries allow nested routes. */
const PILOT_ALLOWED_EXACT = new Set<string>(['/dashboard']);

const PILOT_ALLOWED_PREFIXES = [
  '/dashboard/payment-links',
  '/dashboard/recurring-templates',
  '/dashboard/settings/merchant',
  '/dashboard/settings/integrations',
  '/dashboard/partners/deal-network',
] as const;

export function isDealNetworkPilotDashboardPathAllowed(pathname: string): boolean {
  const p = normalizeMiddlewarePathname(pathname);
  if (PILOT_ALLOWED_EXACT.has(p)) return true;
  return PILOT_ALLOWED_PREFIXES.some(
    (prefix) => p === prefix || p.startsWith(`${prefix}/`)
  );
}
