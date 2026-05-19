/**
 * Branded customer-facing URLs — never expose infrastructure domains (e.g. onrender.com).
 */

const BLOCKED_HOST_PATTERNS = [/onrender\.com/i, /render\.com$/i];

function isBlockedHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return BLOCKED_HOST_PATTERNS.some((p) => p.test(host));
  } catch {
    return false;
  }
}

function sanitizeOrigin(origin: string): string | null {
  const trimmed = origin.trim().replace(/\/+$/, '');
  if (!trimmed || isBlockedHost(trimmed)) return null;
  return trimmed;
}

/** Server-side branded origin for emails, QR codes, and API responses. */
export function getBrandedAppOrigin(requestOrigin?: string): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) {
    const sanitized = sanitizeOrigin(envUrl);
    if (sanitized) return sanitized;
  }
  if (requestOrigin) {
    const sanitized = sanitizeOrigin(requestOrigin);
    if (sanitized) return sanitized;
  }
  return 'http://localhost:3000';
}

/** Client-side branded origin — prefers env-configured domain over window.location when infra host detected. */
export function getClientBrandedOrigin(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) {
    const sanitized = sanitizeOrigin(envUrl);
    if (sanitized) return sanitized;
  }
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    const sanitized = sanitizeOrigin(origin);
    if (sanitized) return sanitized;
  }
  return 'http://localhost:3000';
}

export function getPaymentLinkUrl(shortCode: string, origin?: string): string {
  const base = origin ? getBrandedAppOrigin(origin) : getClientBrandedOrigin();
  return `${base}/pay/${encodeURIComponent(shortCode)}`;
}
