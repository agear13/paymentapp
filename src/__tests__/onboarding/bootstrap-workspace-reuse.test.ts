import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/api-session.server', () => ({
  getCurrentUserForApi: jest.fn(),
}));

jest.mock('@/lib/auth/get-org', () => ({
  getOrganizationForAuthenticatedUser: jest.fn(),
}));

const mockSaveOnboarding = jest.fn().mockResolvedValue(true);

jest.mock('@/lib/onboarding/operator-onboarding.server', () => ({
  saveOperatorOnboardingState: (...args: unknown[]) => mockSaveOnboarding(...args),
  getOperatorOnboardingState: jest.fn(),
}));

const mockConvergence = jest.fn().mockResolvedValue({
  correlationId: 'corr-create',
  snapshot: { currentPhase: 'WORKSPACE_CREATED' },
});

jest.mock('@/lib/operations/onboarding/run-operational-initialization-convergence.server', () => ({
  runOperationalInitializationConvergence: (...args: unknown[]) => mockConvergence(...args),
}));

const mockAttach = jest.fn().mockResolvedValue({ attached: false, participantId: null });

jest.mock('@/lib/participants/participant-workspace-attribution.server', () => {
  const actual = jest.requireActual(
    '@/lib/participants/participant-workspace-attribution.server'
  ) as Record<string, unknown>;
  return {
    ...actual,
    attachParticipantWorkspaceAttribution: (...args: unknown[]) => mockAttach(...args),
  };
});

const mockPilotSnapshot = jest.fn();

jest.mock('@/lib/deal-network-demo/pilot-snapshot.server', () => ({
  getPilotSnapshotForUser: (...args: unknown[]) => mockPilotSnapshot(...args),
}));

const mockOrgCreate = jest.fn();
const mockOrgUpdate = jest.fn();
const mockUserOrgCreate = jest.fn();
const mockSettingsCreate = jest.fn();
const mockSettingsFindFirst = jest.fn();
const mockSettingsUpdateMany = jest.fn();
const mockSettingsUpdate = jest.fn();
const mockParticipantUpdate = jest.fn();
const mockTransitionCreate = jest.fn();

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    organizations: {
      update: (...args: unknown[]) => mockOrgUpdate(...args),
    },
    merchant_settings: {
      findFirst: (...args: unknown[]) => mockSettingsFindFirst(...args),
      updateMany: (...args: unknown[]) => mockSettingsUpdateMany(...args),
      update: (...args: unknown[]) => mockSettingsUpdate(...args),
    },
    user_organizations: {
      create: (...args: unknown[]) => mockUserOrgCreate(...args),
    },
    deal_network_pilot_participants: {
      update: (...args: unknown[]) => mockParticipantUpdate(...args),
    },
    operational_onboarding_transitions: {
      create: (...args: unknown[]) => mockTransitionCreate(...args),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        organizations: { create: mockOrgCreate },
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

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/onboarding/bootstrap-workspace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function expectReuseDidNotMutateWorkspace() {
  expect(mockSettingsUpdateMany).not.toHaveBeenCalled();
  expect(mockSettingsUpdate).not.toHaveBeenCalled();
  expect(mockSettingsCreate).not.toHaveBeenCalled();
  expect(mockOrgCreate).not.toHaveBeenCalled();
  expect(mockOrgUpdate).not.toHaveBeenCalled();
  expect(mockUserOrgCreate).not.toHaveBeenCalled();
  expect(mockSaveOnboarding).not.toHaveBeenCalled();
  expect(mockConvergence).not.toHaveBeenCalled();
  expect(mockPilotSnapshot).not.toHaveBeenCalled();
  expect(mockParticipantUpdate).not.toHaveBeenCalled();
  expect(mockTransitionCreate).not.toHaveBeenCalled();
}

describe('POST /api/onboarding/bootstrap-workspace reuse hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUserForApi.mockResolvedValue({
      user: { id: 'user-1', email: 'alex@example.com' },
      response: null,
    });
    mockGetOrganization.mockResolvedValue({ id: 'org-existing' });
    mockSettingsFindFirst.mockResolvedValue({ id: 'ms-existing' });
    mockOrgCreate.mockResolvedValue({ id: 'org-new', name: 'Studio North' });
    mockUserOrgCreate.mockResolvedValue({});
    mockSettingsCreate.mockResolvedValue({ id: 'ms-new' });
    mockAttach.mockResolvedValue({ attached: true, participantId: 'p-1' });
  });

  it('returns the existing workspace without rewriting merchant settings', async () => {
    const response = await bootstrapWorkspace(
      request({
        workspaceName: 'My Commercial OS',
        defaultCurrency: 'AUD',
        sourceParticipantId: 'p-invite-1',
      })
    );
    const json = (await response.json()) as {
      organizationId: string;
      merchantSettingsId: string | null;
    };

    expect(response.status).toBe(200);
    expect(json.organizationId).toBe('org-existing');
    expect(json.merchantSettingsId).toBe('ms-existing');
    expect(mockSettingsFindFirst).toHaveBeenCalledWith({
      where: { organization_id: 'org-existing' },
      select: { id: true },
    });
    expectReuseDidNotMutateWorkspace();
    expect(mockAttach).toHaveBeenCalledWith({
      userId: 'user-1',
      newOrganizationId: 'org-existing',
      hint: { kind: 'hint', value: 'p-invite-1' },
    });
  });

  it.each([
    { workspaceName: 'My Commercial OS', defaultCurrency: 'AUD' },
    { workspaceName: 'Professional services', defaultCurrency: 'AUD' },
    { workspaceName: "alex's workspace", defaultCurrency: 'AUD' },
    { workspaceName: 'Studio North', defaultCurrency: 'USD' },
  ])(
    'ignores stale request $workspaceName / $defaultCurrency on reuse',
    async (body) => {
      const response = await bootstrapWorkspace(request(body));
      expect(response.status).toBe(200);
      expectReuseDidNotMutateWorkspace();
      expect(mockAttach).not.toHaveBeenCalled();
    }
  );

  it('does not persist a new operational initialization chain on repeated reuse', async () => {
    await bootstrapWorkspace(request({ workspaceName: 'My Commercial OS', defaultCurrency: 'AUD' }));
    await bootstrapWorkspace(
      request({ workspaceName: 'Professional services', defaultCurrency: 'USD' })
    );

    expect(mockConvergence).not.toHaveBeenCalled();
    expect(mockTransitionCreate).not.toHaveBeenCalled();
    expect(mockSettingsUpdateMany).not.toHaveBeenCalled();
  });

  it('does not trigger participant snapshot repair as a side effect of reuse', async () => {
    await bootstrapWorkspace(
      request({
        workspaceName: "alex's workspace",
        defaultCurrency: 'AUD',
        sourceParticipantId: 'p-invite-1',
      })
    );

    expect(mockPilotSnapshot).not.toHaveBeenCalled();
    expect(mockParticipantUpdate).not.toHaveBeenCalled();
    expect(mockAttach).toHaveBeenCalledWith({
      userId: 'user-1',
      newOrganizationId: 'org-existing',
      hint: { kind: 'hint', value: 'p-invite-1' },
    });
  });

  it('still initializes a genuine create from the confirmed request', async () => {
    mockGetOrganization.mockResolvedValue(null);

    const response = await bootstrapWorkspace(
      request({
        workspaceName: 'Studio North',
        defaultCurrency: 'USD',
        industry: 'Events',
        teamSize: '1–5',
        sourceParticipantId: 'p-invite-1',
      })
    );
    const json = (await response.json()) as {
      organizationId: string;
      merchantSettingsId: string;
      correlationId?: string;
    };

    expect(response.status).toBe(201);
    expect(json.organizationId).toBe('org-new');
    expect(json.merchantSettingsId).toBe('ms-new');
    expect(json.correlationId).toBe('corr-create');
    expect(mockOrgCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Studio North',
        subscription_plan: 'professional',
        subscription_status: 'trialing',
      }),
    });
    expect(mockUserOrgCreate).toHaveBeenCalledWith({
      data: {
        user_id: 'user-1',
        organization_id: 'org-new',
        role: 'OWNER',
      },
    });
    expect(mockSettingsCreate).toHaveBeenCalledWith({
      data: {
        organization_id: 'org-new',
        display_name: 'Studio North',
        default_currency: 'USD',
      },
    });
    expect(mockSaveOnboarding).toHaveBeenCalledWith(
      'org-new',
      'user-1',
      expect.objectContaining({
        step: 'use_case',
        workspace_name: 'Studio North',
        workspace_industry: 'Events',
        workspace_team_size: '1–5',
        organizationId: 'org-new',
        merchantSettingsId: 'ms-new',
      }),
      { skipIfEquivalent: true }
    );
    expect(mockConvergence).toHaveBeenCalledWith({
      userId: 'user-1',
      organizationId: 'org-new',
      triggerSource: 'bootstrap-workspace',
    });
    expect(mockAttach).toHaveBeenCalledWith({
      userId: 'user-1',
      newOrganizationId: 'org-new',
      hint: { kind: 'hint', value: 'p-invite-1' },
    });
    expect(mockSettingsUpdateMany).not.toHaveBeenCalled();
  });
});

describe('bootstrap-workspace reuse surface', () => {
  it('keeps reuse as a read-only return of the existing workspace', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/api/onboarding/bootstrap-workspace/route.ts'),
      'utf8'
    );
    const reuse = source.slice(
      source.indexOf('if (existingOrg)'),
      source.indexOf('const result = await prisma.$transaction')
    );

    expect(reuse).toContain('merchant_settings.findFirst');
    expect(reuse).toContain('attachParticipantWorkspaceAttribution');
    expect(reuse).not.toContain('updateMany');
    expect(reuse).not.toContain('saveOperatorOnboardingState');
    expect(reuse).not.toContain('runOperationalInitializationConvergence');
    expect(reuse).not.toContain('step: \'use_case\'');
    expect(reuse).not.toContain('display_name');
    expect(reuse).not.toContain('default_currency');
    expect(source).toContain('runOperationalInitializationConvergence');
    expect(source).toContain('attachParticipantWorkspaceAttribution');
  });
});
