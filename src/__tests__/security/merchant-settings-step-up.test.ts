import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/lib/auth/step-up.server', () => ({
  requirePaymentConfigurationAccess: jest.fn(),
}));

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    merchant_settings: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  log: { info: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/audit/audit-log', () => ({
  AuditEventType: {
    STRIPE_SETTINGS_CHANGED: 'stripe.settings.changed',
    WISE_SETTINGS_CHANGED: 'wise.settings.changed',
    HEDERA_SETTINGS_CHANGED: 'hedera.settings.changed',
    EVM_SETTINGS_CHANGED: 'evm.settings.changed',
  },
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

jest.mock('@/lib/operations/onboarding/run-operational-initialization-convergence.server', () => ({
  runOperationalInitializationConvergence: jest.fn(),
}));

jest.mock('@/lib/operations/onboarding/operational-initialization-events', () => ({
  operationalInitializationEvent: jest.fn(() => ({ type: 'STRIPE_CONNECT_COMPLETED', payload: {} })),
}));

jest.mock('@/lib/auth/session', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('@/lib/auth/organization-access', () => ({
  hasOrganizationPermission: jest.fn(),
}));

import { requirePaymentConfigurationAccess } from '@/lib/auth/step-up.server';
import { prisma } from '@/lib/server/prisma';
import { PATCH } from '@/app/api/merchant-settings/[id]/route';

const mockRequirePaymentConfigurationAccess = requirePaymentConfigurationAccess as jest.Mock;
const mockFindUnique = prisma.merchant_settings.findUnique as jest.Mock;
const mockUpdate = prisma.merchant_settings.update as jest.Mock;

const SETTINGS_ID = '33333333-3333-4333-8333-333333333333';
const ORG_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222';

describe('PATCH /api/merchant-settings/[id] MFA bypass and tenant isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not update payment rails without recent step-up', async () => {
    mockRequirePaymentConfigurationAccess.mockResolvedValue({
      ok: false,
      code: 'MFA_ENROLLMENT_REQUIRED',
      response: NextResponse.json({ code: 'MFA_ENROLLMENT_REQUIRED' }, { status: 403 }),
    });

    const response = await PATCH(
      new NextRequest(`http://localhost/api/merchant-settings/${SETTINGS_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripeAccountId: 'acct_hijack' }),
      }),
      { params: Promise.resolve({ id: SETTINGS_ID }) }
    );

    expect(response.status).toBe(403);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects a settings row that belongs to another organization', async () => {
    mockRequirePaymentConfigurationAccess.mockResolvedValue({
      ok: true,
      user: { id: 'owner-1', email: 'owner@example.com' },
      organizationId: ORG_ID,
    });
    mockFindUnique.mockResolvedValue({
      organization_id: OTHER_ORG_ID,
      stripe_account_id: 'acct_old',
    });

    const response = await PATCH(
      new NextRequest(`http://localhost/api/merchant-settings/${SETTINGS_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripeAccountId: 'acct_hijack' }),
      }),
      { params: Promise.resolve({ id: SETTINGS_ID }) }
    );

    expect(response.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
