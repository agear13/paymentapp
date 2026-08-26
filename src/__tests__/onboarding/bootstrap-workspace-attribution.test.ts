import { NextRequest } from 'next/server';

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

const mockAttach = jest.fn();

jest.mock('@/lib/participants/participant-workspace-attribution.server', () => {
  const actual = jest.requireActual(
    '@/lib/participants/participant-workspace-attribution.server'
  ) as Record<string, unknown>;
  return {
    ...actual,
    attachParticipantWorkspaceAttribution: (...args: unknown[]) => mockAttach(...args),
  };
});

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

function request(body: Record<string, unknown>, search = '') {
  return new NextRequest(`http://localhost/api/onboarding/bootstrap-workspace${search}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/onboarding/bootstrap-workspace attribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUserForApi.mockResolvedValue({
      user: { id: 'user-1', email: 'operator@company.com' },
      response: null,
    });
    mockGetOrganization.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 'org-new', name: 'Acme' });
    mockUserOrgCreate.mockResolvedValue({});
    mockSettingsCreate.mockResolvedValue({ id: 'ms-1' });
    mockAttach.mockResolvedValue({ attached: true, participantId: 'p-1' });
  });

  it('does not attach attribution when an existing organization is reused without a participant hint', async () => {
    mockGetOrganization.mockResolvedValue({ id: 'org-existing' });
    const response = await bootstrapWorkspace(
      request({ workspaceName: 'Acme', defaultCurrency: 'AUD' })
    );
    expect(response.status).toBe(200);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockAttach).not.toHaveBeenCalled();
    const { prisma } = jest.requireMock('@/lib/server/prisma') as {
      prisma: { merchant_settings: { updateMany: jest.Mock } };
    };
    expect(prisma.merchant_settings.updateMany).not.toHaveBeenCalled();
  });

  it('attaches attribution to the reused organisation when a participant hint is present', async () => {
    mockGetOrganization.mockResolvedValue({ id: 'org-existing' });
    const response = await bootstrapWorkspace(
      request({ workspaceName: 'Acme', defaultCurrency: 'AUD', sourceParticipantId: 'p-1' })
    );
    expect(response.status).toBe(200);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockAttach).toHaveBeenCalledWith({
      userId: 'user-1',
      newOrganizationId: 'org-existing',
      hint: { kind: 'hint', value: 'p-1' },
    });
    const { prisma } = jest.requireMock('@/lib/server/prisma') as {
      prisma: { merchant_settings: { updateMany: jest.Mock } };
    };
    expect(prisma.merchant_settings.updateMany).not.toHaveBeenCalled();
  });

  it('attempts attribution only after a genuine organization insert', async () => {
    const response = await bootstrapWorkspace(
      request({
        workspaceName: 'Acme',
        defaultCurrency: 'AUD',
        participantId: 'p-1',
      })
    );
    expect(response.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockAttach).toHaveBeenCalledWith({
      userId: 'user-1',
      newOrganizationId: 'org-new',
      hint: { kind: 'hint', value: 'p-1' },
    });
  });

  it('does not fail workspace creation when attribution throws', async () => {
    mockAttach.mockRejectedValue(new Error('attach exploded'));
    const response = await bootstrapWorkspace(
      request({ workspaceName: 'Acme', defaultCurrency: 'AUD' })
    );
    expect(response.status).toBe(201);
    const json = (await response.json()) as { organizationId: string };
    expect(json.organizationId).toBe('org-new');
  });
});
