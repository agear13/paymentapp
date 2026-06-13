import { NextRequest } from 'next/server';

jest.mock('@/lib/audit/audit-log', () => ({
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
  AuditEventType: { SECURITY_CSRF_VIOLATION: 'security.csrf.violation' },
  AuditSeverity: { WARNING: 'WARNING' },
}));

import {
  createSignedCsrfToken,
  enforceCsrfForRequest,
} from '@/lib/security/csrf';

process.env.CSRF_SECRET = 'test-csrf-secret-minimum-32-characters';
process.env.RELAX_ENV_VALIDATION = '1';

const SESSION_COOKIE = 'sb-localhost-auth-token=fake-session';
const PAYMENT_LINK_ID = '11111111-1111-1111-1111-111111111111';

function makeManualSettlementRequest(opts: {
  csrfCookie?: string;
  csrfHeader?: string;
}) {
  const headers = new Headers();
  const cookies: string[] = [SESSION_COOKIE];
  if (opts.csrfCookie) cookies.unshift(`csrf_token=${opts.csrfCookie}`);
  headers.set('cookie', cookies.join('; '));
  if (opts.csrfHeader) headers.set('x-csrf-token', opts.csrfHeader);

  return new NextRequest(
    `http://localhost/api/payment-links/${PAYMENT_LINK_ID}/manual-settlement`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'mark_paid' }),
    }
  );
}

describe('payment-links manual-settlement CSRF (server)', () => {
  it('accepts double-submit token on mark_paid POST', () => {
    const signedToken = createSignedCsrfToken();
    const request = makeManualSettlementRequest({
      csrfCookie: signedToken,
      csrfHeader: signedToken,
    });

    expect(enforceCsrfForRequest(request)).toBeNull();
  });

  it('rejects mark_paid POST with session cookie but no x-csrf-token header', () => {
    const signedToken = createSignedCsrfToken();
    const request = makeManualSettlementRequest({ csrfCookie: signedToken });

    const block = enforceCsrfForRequest(request);
    expect(block).not.toBeNull();
    expect(block!.status).toBe(403);
  });
});
