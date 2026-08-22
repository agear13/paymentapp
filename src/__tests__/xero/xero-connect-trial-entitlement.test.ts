import { NextRequest } from 'next/server';
import type { EntitlementContext } from '@/lib/entitlements/types';

jest.mock('@/lib/auth/step-up.server', () => ({
  requirePaymentConfigurationAccess: jest.fn(),
  redirectToMfaForStepUp: jest.fn(),
}));

jest.mock('@/lib/xero', () => ({
  generateAuthUrl: jest.fn().mockResolvedValue('https://login.xero.com/identity/connect/authorize'),
  isXeroConfigured: jest.fn(() => true),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
  loggers: { xero: { debug: jest.fn() } },
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

jest.mock('@/lib/entitlements/resolve-context.server', () => ({
  resolveEntitlementContext: jest.fn(),
  resolveProductProfileFromEmail: jest.fn(() => 'standard'),
}));

import { requirePaymentConfigurationAccess } from '@/lib/auth/step-up.server';
import { generateAuthUrl } from '@/lib/xero';
import { resolveEntitlementContext } from '@/lib/entitlements/resolve-context.server';
import { GET as xeroConnect } from '@/app/api/xero/connect/route';

const mockAccess = requirePaymentConfigurationAccess as jest.Mock;
const mockResolve = resolveEntitlementContext as jest.Mock;

function trialContext(expired: boolean): EntitlementContext {
  return {
    organizationId: '11111111-1111-4111-8111-111111111111',
    userId: 'user-1',
    productProfile: 'standard',
    plan: 'professional',
    status: 'trialing',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    trialEndsAt: new Date(Date.now() + (expired ? -24 : 20) * 60 * 60 * 1000 * 24),
    usage: {
      agreementCount: 0,
      aiImportCount: 0,
      teamMemberCount: 1,
      workspaceCount: 1,
    },
    pilotBypass: false,
  };
}

describe('GET /api/xero/connect first-party trial', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccess.mockResolvedValue({
      ok: true,
      user: { id: 'user-1', email: 'operator@company.com' },
      organizationId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('allows Xero OAuth during an active Professional Trial', async () => {
    mockResolve.mockResolvedValue(trialContext(false));

    const response = await xeroConnect(
      new NextRequest(
        'http://localhost/api/xero/connect?organization_id=11111111-1111-4111-8111-111111111111'
      )
    );

    expect(generateAuthUrl).toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('login.xero.com');
  });

  it('denies Xero OAuth after the Professional Trial expires', async () => {
    mockResolve.mockResolvedValue(trialContext(true));

    const response = await xeroConnect(
      new NextRequest(
        'http://localhost/api/xero/connect?organization_id=11111111-1111-4111-8111-111111111111'
      )
    );
    const body = await response.json();

    expect(generateAuthUrl).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
    expect(body.code).toBe('ENTITLEMENT_REQUIRED');
    expect(body.feature).toBe('xero_integration');
  });
});
