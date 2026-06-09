/**
 * CSRF policy: which routes require double-submit tokens and which are exempt.
 */

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Public, webhook, cron, and token-authenticated internal routes — no session CSRF. */
export const CSRF_EXEMPT_PATH_PREFIXES = [
  '/api/public/',
  '/api/stripe/webhook',
  '/api/webhooks/',
  '/api/internal/',
  '/api/jobs/',
  '/api/health',
  '/api/build-info',
  '/api/stripe/create-checkout-session',
  '/api/stripe/create-payment-intent',
  '/api/stripe/active-checkout-session',
  '/api/hedera/confirm',
  '/api/referral/',
  '/api/referrals/payment-completed',
  '/api/referrals/submit-lead',
  '/api/referrals/submit-review',
  '/api/referrals/track-attribution',
  '/api/fx/',
  '/api/hedera/payment-amounts',
  '/api/hedera/transactions/',
  '/api/test/',
  '/api/huntpay/',
  '/api/security/csrf-token',
  '/api/auth/',
] as const;

export function isMutatingMethod(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase());
}

export function isCsrfExemptPath(pathname: string): boolean {
  return CSRF_EXEMPT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function hasSupabaseSessionCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  return /(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/.test(cookieHeader);
}
