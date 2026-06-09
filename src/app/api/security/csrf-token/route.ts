import { NextRequest, NextResponse } from 'next/server';
import { resolveClientCsrfToken, setCSRFCookie } from '@/lib/security/csrf';

/**
 * GET /api/security/csrf-token
 * Issues or reuses a signed CSRF token cookie + body value for dashboard clients.
 */
export async function GET(request: NextRequest) {
  const signedToken = resolveClientCsrfToken(request);
  const response = NextResponse.json({ csrfToken: signedToken });
  setCSRFCookie(response, signedToken);
  return response;
}
