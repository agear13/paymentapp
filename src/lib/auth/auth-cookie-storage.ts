export function isPkceCodeVerifierCookieName(name: string): boolean {
  return /^sb-.+-auth-token-code-verifier$/.test(name);
}

export function hasPkceCodeVerifierCookie(
  cookies: Array<{ name: string; value: string }>
): boolean {
  return cookies.some((cookie) => isPkceCodeVerifierCookieName(cookie.name) && Boolean(cookie.value));
}

export function mergeAuthCookieLists(
  requestCookies: Array<{ name: string; value: string }>,
  bufferCookies: Array<{ name: string; value: string }>
): Array<{ name: string; value: string }> {
  const merged = new Map<string, { name: string; value: string }>();
  for (const cookie of requestCookies) {
    merged.set(cookie.name, { name: cookie.name, value: cookie.value });
  }
  for (const cookie of bufferCookies) {
    merged.set(cookie.name, { name: cookie.name, value: cookie.value });
  }
  return [...merged.values()];
}

function isLoopbackCookieDomain(domain: string): boolean {
  const host = domain.replace(/^\./, '').split(':')[0]?.toLowerCase() ?? '';
  return host === 'localhost' || host === '127.0.0.1';
}

/**
 * PKCE verifier cookies must be host-only on the browser-visible domain.
 * Render's internal host is localhost:10000; a Domain=localhost cookie is
 * dropped by the browser on www.provvypay.com / *.onrender.com.
 */
export function sanitizeAuthCookieOptions(
  options?: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(options ?? {}) };
  const domain = typeof next.domain === 'string' ? next.domain : '';
  if (!domain || isLoopbackCookieDomain(domain)) {
    delete next.domain;
  }
  if (!next.path) next.path = '/';
  if (process.env.NODE_ENV === 'production') {
    next.secure = true;
  }
  if (next.sameSite == null) {
    next.sameSite = 'lax';
  }
  return next;
}
