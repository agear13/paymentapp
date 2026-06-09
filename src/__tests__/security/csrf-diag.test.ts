import { NextRequest } from 'next/server';

jest.mock('@/lib/audit/audit-log', () => ({
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
  AuditEventType: { SECURITY_CSRF_VIOLATION: 'security.csrf.violation' },
  AuditSeverity: { WARNING: 'WARNING' },
}));

import {
  createSignedCsrfToken,
  enforceCsrfForRequest,
  getCsrfValidationDiagnostics,
} from '@/lib/security/csrf';

process.env.CSRF_SECRET = 'test-csrf-secret-minimum-32-characters';
process.env.RELAX_ENV_VALIDATION = '1';

function makeRequest(opts: {
  method: string;
  path: string;
  csrfCookie?: string;
  csrfHeader?: string;
  sessionCookie?: string;
}) {
  const headers = new Headers();
  const cookies: string[] = [];
  if (opts.sessionCookie) cookies.push(opts.sessionCookie);
  if (opts.csrfCookie) cookies.push(`csrf_token=${opts.csrfCookie}`);
  if (cookies.length) headers.set('cookie', cookies.join('; '));
  if (opts.csrfHeader) headers.set('x-csrf-token', opts.csrfHeader);

  return new NextRequest(`http://localhost${opts.path}`, {
    method: opts.method,
    headers,
  });
}

describe('CSRF diagnostics for bootstrap-workspace 403 branches', () => {
  const signedToken = createSignedCsrfToken();
  const sessionCookie = 'sb-localhost-auth-token=fake-session';
  const path = '/api/onboarding/bootstrap-workspace';

  it('reports no_cookie when session present but csrf cookie missing', async () => {
    const request = makeRequest({ method: 'POST', path, sessionCookie });
    const diag = getCsrfValidationDiagnostics(request);

    expect(diag).toMatchObject({
      hasCsrfCookie: false,
      hasCsrfHeader: false,
      cookieMatchesHeader: false,
      signatureValid: false,
      failingBranch: 'no_cookie',
    });

    const block = enforceCsrfForRequest(request);
    const body = await block!.json();
    expect(block?.status).toBe(403);
    expect(body).toMatchObject({
      error: 'CSRF validation failed',
      csrfDiag: { failingBranch: 'no_cookie' },
    });
  });

  it('reports no_header when cookie present but x-csrf-token missing', async () => {
    const request = makeRequest({
      method: 'POST',
      path,
      sessionCookie,
      csrfCookie: signedToken,
    });
    const diag = getCsrfValidationDiagnostics(request);

    expect(diag).toMatchObject({
      hasCsrfCookie: true,
      hasCsrfHeader: false,
      cookieMatchesHeader: false,
      signatureValid: false,
      failingBranch: 'no_header',
    });
  });

  it('reports cookie_header_mismatch when values differ', async () => {
    const request = makeRequest({
      method: 'POST',
      path,
      sessionCookie,
      csrfCookie: signedToken,
      csrfHeader: 'different-token.signature',
    });
    const diag = getCsrfValidationDiagnostics(request);

    expect(diag).toMatchObject({
      hasCsrfCookie: true,
      hasCsrfHeader: true,
      cookieMatchesHeader: false,
      signatureValid: false,
      failingBranch: 'cookie_header_mismatch',
    });
  });

  it('reports invalid_signature when values match but signature is wrong', async () => {
    const badSigned = `${signedToken.split('.')[0]}.invalid-signature`;
    const request = makeRequest({
      method: 'POST',
      path,
      sessionCookie,
      csrfCookie: badSigned,
      csrfHeader: badSigned,
    });
    const diag = getCsrfValidationDiagnostics(request);

    expect(diag).toMatchObject({
      hasCsrfCookie: true,
      hasCsrfHeader: true,
      cookieMatchesHeader: true,
      signatureValid: false,
      failingBranch: 'invalid_signature',
    });
  });

  it('reports none when cookie, header, and signature are valid', () => {
    const request = makeRequest({
      method: 'POST',
      path,
      sessionCookie,
      csrfCookie: signedToken,
      csrfHeader: signedToken,
    });
    const diag = getCsrfValidationDiagnostics(request);

    expect(diag).toMatchObject({
      hasCsrfCookie: true,
      hasCsrfHeader: true,
      cookieMatchesHeader: true,
      signatureValid: true,
      failingBranch: 'none',
    });
    expect(enforceCsrfForRequest(request)).toBeNull();
  });
});
