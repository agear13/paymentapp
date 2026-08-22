import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import {
  PROFESSIONAL_TRIAL_DAYS,
  journeyWorkspaceSubscriptionCreate,
} from '@/lib/entitlements/professional-trial';

jest.mock('@/lib/auth/api-session.server', () => ({
  getCurrentUserForApi: jest.fn(),
}));

jest.mock('@/lib/auth/get-org', () => ({
  getOrganizationForAuthenticatedUser: jest.fn(),
}));

jest.mock('@/lib/onboarding/operator-onboarding.server', () => ({
  saveOperatorOnboardingState: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/operations/onboarding/run-operational-initialization-convergence.server', () => ({
  runOperationalInitializationConvergence: jest.fn().mockResolvedValue({
    correlationId: 'corr-1',
    snapshot: {},
  }),
}));

const mockCreate = jest.fn();
const mockUserOrgCreate = jest.fn();
const mockSettingsCreate = jest.fn();

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    merchant_settings: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        organizations: { create: mockCreate },
        user_organizations: { create: mockUserOrgCreate },
        merchant_settings: { create: mockSettingsCreate },
      })
    ),
  },
}));

import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { POST as bootstrapWorkspace } from '@/app/api/onboarding/bootstrap-workspace/route';

const mockGetCurrentUserForApi = getCurrentUserForApi as jest.Mock;
const mockGetOrganization = getOrganizationForAuthenticatedUser as jest.Mock;

describe('POST /api/onboarding/bootstrap-workspace trial assignment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUserForApi.mockResolvedValue({
      user: { id: 'user-1', email: 'operator@company.com' },
      response: null,
    });
    mockGetOrganization.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: 'org-new',
      name: 'Acme',
    });
    mockUserOrgCreate.mockResolvedValue({});
    mockSettingsCreate.mockResolvedValue({ id: 'ms-1' });
  });

  it('assigns a new journey workspace Professional + trialing + 30-day trial_ends_at', async () => {
    const before = Date.now();
    const response = await bootstrapWorkspace(
      new NextRequest('http://localhost/api/onboarding/bootstrap-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceName: 'Acme',
          defaultCurrency: 'AUD',
          industry: 'Hospitality',
          teamSize: '1-10',
        }),
      })
    );
    const after = Date.now();

    expect(response.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const data = mockCreate.mock.calls[0][0].data as {
      subscription_plan: string;
      subscription_status: string;
      trial_ends_at: Date;
      stripe_subscription_id?: string;
    };
    expect(data.subscription_plan).toBe('professional');
    expect(data.subscription_status).toBe('trialing');
    expect(data.stripe_subscription_id).toBeUndefined();
    const minEnd = before + PROFESSIONAL_TRIAL_DAYS * 24 * 60 * 60 * 1000;
    const maxEnd = after + PROFESSIONAL_TRIAL_DAYS * 24 * 60 * 60 * 1000;
    expect(data.trial_ends_at.getTime()).toBeGreaterThanOrEqual(minEnd - 1000);
    expect(data.trial_ends_at.getTime()).toBeLessThanOrEqual(maxEnd + 1000);
  });

  it('does not rewrite subscription state when the user already has an organisation', async () => {
    mockGetOrganization.mockResolvedValue({ id: 'org-existing' });

    const response = await bootstrapWorkspace(
      new NextRequest('http://localhost/api/onboarding/bootstrap-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceName: 'Acme',
          defaultCurrency: 'AUD',
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('uses the shared journey trial payload helper', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/api/onboarding/bootstrap-workspace/route.ts'),
      'utf8'
    );
    expect(source).toContain('journeyWorkspaceSubscriptionCreate');
    const payload = journeyWorkspaceSubscriptionCreate(new Date('2026-08-22T00:00:00.000Z'));
    expect(payload.subscription_plan).toBe('professional');
  });
});
