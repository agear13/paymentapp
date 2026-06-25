import type { NextRequest } from 'next/server';
import { resolveRequestOrigin } from '@/lib/runtime/customer-facing-url';

/**
 * Build the post-OAuth redirect target for Xero settings.
 * Prefer the request origin so dev/staging hosts match where the callback ran.
 */
export function xeroIntegrationsRedirectUrl(
  request: NextRequest,
  query: Record<string, string>
): string {
  const origin =
    resolveRequestOrigin(request) ??
    process.env.NEXT_PUBLIC_APP_URL ??
    request.nextUrl.origin;
  const params = new URLSearchParams(query);
  return `${origin.replace(/\/$/, '')}/dashboard/settings/integrations?${params.toString()}`;
}

/**
 * Full callback URL for xero-node apiCallback — must include code and state query params.
 */
export function buildXeroOAuthCallbackUrl(request: NextRequest): string {
  return request.url;
}
