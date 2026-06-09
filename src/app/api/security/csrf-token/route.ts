import { NextResponse } from 'next/server';
import { createSignedCsrfToken, setCSRFCookie } from '@/lib/security/csrf';

/**
 * GET /api/security/csrf-token
 * Issues a signed CSRF token cookie + body value for dashboard clients.
 */
export async function GET() {
  const signedToken = createSignedCsrfToken();
  const response = NextResponse.json({ csrfToken: signedToken });
  setCSRFCookie(response, signedToken);
  return response;
}
