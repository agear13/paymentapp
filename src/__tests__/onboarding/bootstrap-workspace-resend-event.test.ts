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
    correlationId: 'corr-event',
    snapshot: { currentPhase: 'WORKSPACE_CREATED' },
  }),
}));

jest.mock('@/lib/participants/participant-workspace-attribution.server', () => ({
  attachParticipantWorkspaceAttribution: jest.fn().mockResolvedValue({
    attached: false,
    participantId: null,
  }),
  readSourceParticipantHint: jest.fn().mockReturnValue({ kind: 'absent' }),
}));

const mockTriggerWelcome = jest.fn().mockResolvedValue({ success: true, status: 'sent' });
const mockEmitWorkspaceCreatedEvent = jest.fn().mockResolvedValue({ emitted: true });

jest.mock('@/lib/email/lifecycle/lifecycle-service', () => ({
  triggerWelcomeOnBootstrap: (...args: unknown[]) => mockTriggerWelcome(...args),
}));

jest.mock('@/lib/email/lifecycle/resend-events', () => ({
  emitWorkspaceCreatedEvent: (...args: unknown[]) => mockEmitWorkspaceCreatedEvent(...args),
}));

const mockOrgCreate = jest.fn();
const mockUserOrgCreate = jest.fn();
const mockSettingsCreate = jest.fn();
const mockSettingsFindFirst = jest.fn();
const mockTransaction = jest.fn(
  async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      organizations: { create: mockOrgCreate },
      user_organizations: { create: mockUserOrgCreate },
      merchant_settings: { create: mockSettingsCreate },
    })
);

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    merchant_settings: {
      findFirst: (...args: unknown[]) => mockSettingsFindFirst(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { POST as bootstrapWorkspace } from '@/app/api/onboarding/bootstrap-workspace/route';

const mockGetCurrentUserForApi = getCurrentUserForApi as jest.Mock;
const mockGetOrganization = getOrganizationForAuthenticatedUser as jest.Mock;

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/onboarding/bootstrap-workspace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/onboarding/bootstrap-workspace Resend workspace.created event', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUserForApi.mockResolvedValue({
      user: { id: 'user-1', email: 'alex@example.com' },
      response: null,
    });
    mockGetOrganization.mockResolvedValue(null);
    mockOrgCreate.mockResolvedValue({ id: 'org-new', name: 'Studio North' });
    mockUserOrgCreate.mockResolvedValue({});
    mockSettingsCreate.mockResolvedValue({ id: 'ms-new' });
    mockSettingsFindFirst.mockResolvedValue({ id: 'ms-existing' });
    mockTriggerWelcome.mockResolvedValue({ success: true, status: 'sent' });
    mockEmitWorkspaceCreatedEvent.mockResolvedValue({ emitted: true });
  });

  it('emits the Resend lifecycle event after a successful workspace create', async () => {
    const response = await bootstrapWorkspace(
      request({ workspaceName: 'Studio North', defaultCurrency: 'USD' })
    );

    expect(response.status).toBe(201);
    expect(mockTriggerWelcome).toHaveBeenCalledTimes(1);
    expect(mockEmitWorkspaceCreatedEvent).toHaveBeenCalledTimes(1);
    expect(mockEmitWorkspaceCreatedEvent).toHaveBeenCalledWith({
      email: 'alex@example.com',
      userId: 'user-1',
      organizationId: 'org-new',
      workspaceName: 'Studio North',
    });
    expect(mockTriggerWelcome.mock.invocationCallOrder[0]).toBeLessThan(
      mockEmitWorkspaceCreatedEvent.mock.invocationCallOrder[0]
    );
  });

  it('does not fail workspace bootstrap when the Resend event helper rejects', async () => {
    mockEmitWorkspaceCreatedEvent.mockRejectedValue(new Error('resend events down'));

    const response = await bootstrapWorkspace(
      request({ workspaceName: 'Studio North', defaultCurrency: 'USD' })
    );
    const json = (await response.json()) as { organizationId: string };

    expect(response.status).toBe(201);
    expect(json.organizationId).toBe('org-new');
    expect(mockTriggerWelcome).toHaveBeenCalledTimes(1);
  });

  it('does not emit the event when workspace reuse short-circuits create', async () => {
    mockGetOrganization.mockResolvedValue({ id: 'org-existing' });

    const response = await bootstrapWorkspace(
      request({ workspaceName: 'Studio North', defaultCurrency: 'USD' })
    );

    expect(response.status).toBe(200);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockOrgCreate).not.toHaveBeenCalled();
    expect(mockTriggerWelcome).not.toHaveBeenCalled();
    expect(mockEmitWorkspaceCreatedEvent).not.toHaveBeenCalled();
  });

  it('does not emit the event when workspace creation fails', async () => {
    mockTransaction.mockRejectedValue(new Error('insert failed'));

    await expect(
      bootstrapWorkspace(request({ workspaceName: 'Studio North', defaultCurrency: 'USD' }))
    ).rejects.toThrow('insert failed');

    expect(mockTriggerWelcome).not.toHaveBeenCalled();
    expect(mockEmitWorkspaceCreatedEvent).not.toHaveBeenCalled();
  });
});
