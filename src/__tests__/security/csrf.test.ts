import { NextRequest } from 'next/server';

jest.mock('@/lib/audit/audit-log', () => ({
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
  AuditEventType: { SECURITY_CSRF_VIOLATION: 'security.csrf.violation' },
  AuditSeverity: { WARNING: 'WARNING' },
}));

import {
  createSignedCsrfToken,
  diagnoseCsrfValidation,
  enforceCsrfForRequest,
  validateCSRFToken,
} from '@/lib/security/csrf';

process.env.CSRF_SECRET = 'test-csrf-secret-minimum-32-characters';
process.env.RELAX_ENV_VALIDATION = '1';

function makeRequest(opts: {
  method: string;
  path: string;
  csrfCookie?: string;
  csrfHeader?: string;
  sessionCookie?: string;
  origin?: string;
}) {
  const headers = new Headers();
  const cookies: string[] = [];
  if (opts.sessionCookie) cookies.push(opts.sessionCookie);
  if (opts.csrfCookie) cookies.push(`csrf_token=${opts.csrfCookie}`);
  if (cookies.length) headers.set('cookie', cookies.join('; '));
  if (opts.csrfHeader) headers.set('x-csrf-token', opts.csrfHeader);
  if (opts.origin) headers.set('origin', opts.origin);

  return new NextRequest(`http://localhost${opts.path}`, {
    method: opts.method,
    headers,
  });
}

describe('CSRF protection', () => {
  const signedToken = createSignedCsrfToken();
  const sessionCookie = 'sb-localhost-auth-token=fake-session';

  it('valid CSRF token succeeds', () => {
    const request = makeRequest({
      method: 'POST',
      path: '/api/payment-links',
      csrfCookie: signedToken,
      csrfHeader: signedToken,
      sessionCookie,
    });

    expect(enforceCsrfForRequest(request)).toBeNull();
    expect(validateCSRFToken(request)).toBe(true);
  });

  it('missing CSRF token fails', () => {
    const request = makeRequest({
      method: 'POST',
      path: '/api/payment-links',
      sessionCookie,
    });

    const block = enforceCsrfForRequest(request);
    expect(block).not.toBeNull();
    expect(block!.status).toBe(403);
    expect(diagnoseCsrfValidation(request).reason).toBe('missing_cookie');
  });

  it('missing CSRF header fails with missing_header reason', () => {
    const request = makeRequest({
      method: 'POST',
      path: '/api/payment-links',
      csrfCookie: signedToken,
      sessionCookie,
    });

    expect(diagnoseCsrfValidation(request).reason).toBe('missing_header');
    expect(enforceCsrfForRequest(request)?.status).toBe(403);
  });

  it('invalid CSRF token fails', () => {
    const request = makeRequest({
      method: 'POST',
      path: '/api/payment-links',
      csrfCookie: signedToken,
      csrfHeader: 'not-a-valid-token.signature',
      sessionCookie,
    });

    expect(enforceCsrfForRequest(request)?.status).toBe(403);
  });

  it('accepts a percent-encoded csrf_token cookie against a decoded header', () => {
    const encodedCookie = encodeURIComponent(signedToken);
    const request = makeRequest({
      method: 'POST',
      path: '/api/onboarding/bootstrap-workspace',
      csrfCookie: encodedCookie,
      csrfHeader: signedToken,
      sessionCookie,
    });

    expect(validateCSRFToken(request)).toBe(true);
    expect(enforceCsrfForRequest(request)).toBeNull();
  });

  it('cross-origin request without custom header fails', () => {
    const request = makeRequest({
      method: 'POST',
      path: '/api/organizations',
      csrfCookie: signedToken,
      sessionCookie,
      origin: 'https://evil.example',
    });

    expect(enforceCsrfForRequest(request)?.status).toBe(403);
  });

  it('exempt webhook paths skip CSRF', () => {
    const request = makeRequest({
      method: 'POST',
      path: '/api/stripe/webhook',
      sessionCookie,
    });

    expect(enforceCsrfForRequest(request)).toBeNull();
  });

  it('safe GET requests skip CSRF', () => {
    const request = makeRequest({
      method: 'GET',
      path: '/api/payment-links',
      sessionCookie,
    });

    expect(enforceCsrfForRequest(request)).toBeNull();
  });

  it('public checkout paths skip CSRF', () => {
    const request = makeRequest({
      method: 'POST',
      path: '/api/stripe/create-checkout-session',
      sessionCookie,
    });

    expect(enforceCsrfForRequest(request)).toBeNull();
  });
});
