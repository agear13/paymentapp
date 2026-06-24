/**
 * Content-Security-Policy for Provvypay.
 *
 * unsafe-eval: Next.js dev HMR only — omitted in production.
 * unsafe-inline (scripts): Next.js App Router hydration + Stripe.js bootstrap — retained in production
 *   until middleware nonce injection is adopted (see SECURITY docs).
 */

function isDevelopmentRuntime(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function buildContentSecurityPolicy(options?: {
  reportOnly?: boolean;
  isDevelopment?: boolean;
}): string {
  const isDev = options?.isDevelopment ?? isDevelopmentRuntime();

  const scriptSrc = [
    "'self'",
    ...(isDev ? ["'unsafe-inline'", "'unsafe-eval'"] : ["'unsafe-inline'"]),
    'https://js.stripe.com',
    'https://*.supabase.co',
    'https://challenges.cloudflare.com',
  ];

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://checkout.stripe.com",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://checkout.stripe.com https://*.upstash.io https://challenges.cloudflare.com",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
  ];

  return directives.join('; ');
}

export const CONTENT_SECURITY_POLICY = buildContentSecurityPolicy();
export const CONTENT_SECURITY_POLICY_PRODUCTION = buildContentSecurityPolicy({ isDevelopment: false });