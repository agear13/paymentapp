import type { NextRequest } from 'next/server';
import { resolveRequestOrigin } from '@/lib/runtime/customer-facing-url';
import { resolveXeroOAuthReturnPath } from '@/lib/xero/oauth-return-path';

/**
 * Build the post-OAuth redirect target after Xero connect/callback.
 * Prefer the request origin so dev/staging hosts match where the callback ran.
 */
export function xeroIntegrationsRedirectUrl(
  request: NextRequest,
  query: Record<string, string>,
  returnPath?: string | null
): string {
  const origin =
    resolveRequestOrigin(request) ??
    process.env.NEXT_PUBLIC_APP_URL ??
    request.nextUrl.origin;
  const params = new URLSearchParams(query);
  const path = resolveXeroOAuthReturnPath(returnPath);
  return `${origin.replace(/\/$/, '')}${path}?${params.toString()}`;
}

/**
 * Full callback URL for xero-node apiCallback — must include code and state query params.
 */
export function buildXeroOAuthCallbackUrl(request: NextRequest): string {
  return request.url;
}
