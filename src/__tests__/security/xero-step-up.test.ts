import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/lib/auth/step-up.server', () => ({
  requirePaymentConfigurationAccess: jest.fn(),
  redirectToMfaForStepUp: jest.fn(),
}));

jest.mock('@/lib/xero', () => ({
  disconnectXero: jest.fn(),
  generateAuthUrl: jest.fn(),
  isXeroConfigured: jest.fn(() => true),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
  loggers: { xero: { debug: jest.fn() } },
}));

jest.mock('@/lib/audit/audit-log', () => ({
  AuditEventType: { XERO_DISCONNECTED: 'xero.disconnected' },
  AuditSeverity: { INFO: 'info' },
  createAuditLog: jest.fn(),
}));

jest.mock('@/lib/audit/request-context.server', () => ({
  extractRequestAuditContext: jest.fn(() => ({
    ipAddress: '127.0.0.1',
    userAgent: 'test',
    correlationId: 'corr',
  })),
}));

jest.mock('@/lib/auth/sensitive-action-notify.server', () => ({
  notifyAccountSecurityEvent: jest.fn(),
}));

jest.mock('@/lib/security/oauth-state', () => ({
  signOAuthState: jest.fn(() => 'signed-state'),
}));

jest.mock('@/lib/xero/oauth-state-trace', () => ({
  hashOAuthState: jest.fn(() => 'hash'),
}));

jest.mock('@/lib/xero/oauth-return-path', () => ({
  normalizeXeroOAuthReturnPath: jest.fn(() => null),
}));

import { requirePaymentConfigurationAccess, redirectToMfaForStepUp } from '@/lib/auth/step-up.server';
import { GET as xeroConnect } from '@/app/api/xero/connect/route';
import { POST as xeroDisconnect } from '@/app/api/xero/disconnect/route';

const mockRequirePaymentConfigurationAccess = requirePaymentConfigurationAccess as jest.Mock;
const mockRedirectToMfaForStepUp = redirectToMfaForStepUp as jest.Mock;

describe('Xero connect/disconnect step-up protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks Xero disconnect without recent MFA/AAL2', async () => {
    mockRequirePaymentConfigurationAccess.mockResolvedValue({
      ok: false,
      code: 'STEP_UP_REQUIRED',
      response: NextResponse.json({ code: 'STEP_UP_REQUIRED' }, { status: 403 }),
    });

    const response = await xeroDisconnect(
      new NextRequest('http://localhost/api/xero/disconnect', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(403);
  });

  it('redirects Xero connect to MFA when step-up is required', async () => {
    mockRequirePaymentConfigurationAccess.mockResolvedValue({
      ok: false,
      code: 'STEP_UP_REQUIRED',
      response: NextResponse.json({ code: 'STEP_UP_REQUIRED' }, { status: 403 }),
    });
    mockRedirectToMfaForStepUp.mockReturnValue(
      NextResponse.redirect('http://localhost/auth/mfa?reason=STEP_UP_REQUIRED')
    );

    const response = await xeroConnect(
      new NextRequest('http://localhost/api/xero/connect?organization_id=11111111-1111-4111-8111-111111111111')
    );

    expect(mockRedirectToMfaForStepUp).toHaveBeenCalled();
    expect(response.status).toBe(307);
  });

  it('allows Xero disconnect after recent AAL2 step-up', async () => {
    mockRequirePaymentConfigurationAccess.mockResolvedValue({
      ok: true,
      user: { id: 'owner-1', email: 'owner@example.com' },
      organizationId: '11111111-1111-4111-8111-111111111111',
    });

    const response = await xeroDisconnect(
      new NextRequest('http://localhost/api/xero/disconnect', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(200);
  });
});
