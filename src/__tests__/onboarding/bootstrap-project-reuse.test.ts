import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import type { OperatorOnboardingState } from '@/lib/onboarding/operator-onboarding-types';

jest.mock('@/lib/auth/api-session.server', () => ({
  getCurrentUserForApi: jest.fn(),
}));

jest.mock('@/lib/auth/get-org', () => ({
  getOrganizationForAuthenticatedUser: jest.fn(),
}));

const EQUIVALENCE_KEYS: (keyof OperatorOnboardingState)[] = [
  'step',
  'workspace_name',
  'workspace_industry',
  'workspace_team_size',
  'onboarding_use_case',
  'onboarding_context',
  'organizationId',
  'merchantSettingsId',
  'projectId',
  'completed',
  'completedAt',
  'collection_preference',
  'pending_billing_plan',
];

const mockGetOnboarding = jest.fn();
const mockOnboardingWrites = jest.fn();
const mockSaveOnboarding = jest.fn(
  async (
    organizationId: string,
    userId: string,
    state: OperatorOnboardingState,
    options?: { skipIfEquivalent?: boolean }
  ) => {
    if (options?.skipIfEquivalent) {
      const current = (await mockGetOnboarding(organizationId)) as OperatorOnboardingState | null;
      if (
        current &&
        EQUIVALENCE_KEYS.every((key) => current[key] === state[key])
      ) {
        return false;
      }
    }
    mockOnboardingWrites(organizationId, userId, state);
    return true;
  }
);

jest.mock('@/lib/onboarding/operator-onboarding.server', () => ({
  getOperatorOnboardingState: (...args: unknown[]) => mockGetOnboarding(...args),
  saveOperatorOnboardingState: (...args: unknown[]) => mockSaveOnboarding(...args),
}));

const mockConvergence = jest.fn().mockResolvedValue({
  correlationId: 'corr-project',
  snapshot: { currentPhase: 'PROJECT_CREATED' },
});

jest.mock('@/lib/operations/onboarding/run-operational-initialization-convergence.server', () => ({
  runOperationalInitializationConvergence: (...args: unknown[]) => mockConvergence(...args),
}));

jest.mock('@/lib/entitlements/gate-api.server', () => ({
  requireEntitlement: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/operations/orchestration/activation-bridge', () => ({
  deriveWorkspaceActivationFromOperations: jest.fn(),
}));

const mockPersistDeal = jest.fn().mockResolvedValue(undefined);
const mockFindOnboardingDealId = jest.fn().mockResolvedValue(undefined);
const mockGetPilot = jest.fn();
const mockSyncPilot = jest.fn();

jest.mock('@/lib/deal-network-demo/pilot-snapshot.server', () => ({
  persistPilotDealForUser: (...args: unknown[]) => mockPersistDeal(...args),
  findOnboardingDealIdByName: (...args: unknown[]) => mockFindOnboardingDealId(...args),
  getPilotSnapshotForUser: (...args: unknown[]) => mockGetPilot(...args),
  syncPilotSnapshotForUser: (...args: unknown[]) => mockSyncPilot(...args),
}));

const mockOrgCreate = jest.fn();
const mockOrgUpdate = jest.fn();
const mockUserOrgCreate = jest.fn();
const mockSettingsCreate = jest.fn();
const mockSettingsFindFirst = jest.fn();
const mockSettingsUpdate = jest.fn();
const mockSettingsUpdateMany = jest.fn();
const mockTransitionCreate = jest.fn();
const mockTransitionFindFirst = jest.fn();
const mockTransitionFindMany = jest.fn();

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    organizations: {
      update: (...args: unknown[]) => mockOrgUpdate(...args),
    },
    merchant_settings: {
      findFirst: (...args: unknown[]) => mockSettingsFindFirst(...args),
      update: (...args: unknown[]) => mockSettingsUpdate(...args),
      updateMany: (...args: unknown[]) => mockSettingsUpdateMany(...args),
      create: (...args: unknown[]) => mockSettingsCreate(...args),
    },
    user_organizations: {
      create: (...args: unknown[]) => mockUserOrgCreate(...args),
    },
    operational_onboarding_transitions: {
      create: (...args: unknown[]) => mockTransitionCreate(...args),
      findFirst: (...args: unknown[]) => mockTransitionFindFirst(...args),
      findMany: (...args: unknown[]) => mockTransitionFindMany(...args),
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
import { requireEntitlement } from '@/lib/entitlements/gate-api.server';
import { POST as bootstrapProject } from '@/app/api/onboarding/bootstrap-project/route';

const mockGetCurrentUserForApi = getCurrentUserForApi as jest.Mock;
const mockGetOrganization = getOrganizationForAuthenticatedUser as jest.Mock;
const mockRequireEntitlement = requireEntitlement as jest.Mock;

const ORG = 'org-existing';
const USER = 'user-1';
const SETTINGS = 'ms-existing';

const inProgress: OperatorOnboardingState = {
  step: 'use_case',
  workspace_name: 'Northwind',
  workspace_industry: 'Events',
  workspace_team_size: '1–5',
  onboarding_use_case: 'event_settlement',
  onboarding_context: '{"source":"journey_assessment"}',
  organizationId: ORG,
  merchantSettingsId: SETTINGS,
  collection_preference: 'decide_later',
  completed: false,
};

const completed: OperatorOnboardingState = {
  step: 'complete',
  completed: true,
  completedAt: '2026-08-01T00:00:00.000Z',
  projectId: 'deal-old',
  workspace_name: 'Northwind',
  onboarding_context: 'Event Settlement',
  organizationId: ORG,
  merchantSettingsId: SETTINGS,
};

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/onboarding/bootstrap-project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function expectExistingOrgDidNotMutateWorkspaceIdentity() {
  expect(mockSettingsUpdate).not.toHaveBeenCalled();
  expect(mockSettingsUpdateMany).not.toHaveBeenCalled();
  expect(mockSettingsCreate).not.toHaveBeenCalled();
  expect(mockOrgCreate).not.toHaveBeenCalled();
  expect(mockOrgUpdate).not.toHaveBeenCalled();
  expect(mockUserOrgCreate).not.toHaveBeenCalled();
}

function expectExistingOrgDidNotConverge(json?: Record<string, unknown>) {
  expect(mockConvergence).not.toHaveBeenCalled();
  expect(mockTransitionCreate).not.toHaveBeenCalled();
  expect(mockTransitionFindFirst).not.toHaveBeenCalled();
  expect(mockTransitionFindMany).not.toHaveBeenCalled();
  if (json) {
    expect(json).not.toHaveProperty('correlationId');
    expect(json).not.toHaveProperty('operationalInitialization');
    expect(json).not.toHaveProperty('operationalOnboarding');
  }
}

function expectProjectPersistIsolated(
  projectId: string,
  extras?: Record<string, unknown>
) {
  expect(mockPersistDeal).toHaveBeenCalledWith(
    USER,
    expect.objectContaining({ id: projectId, ...extras })
  );
  expect(mockGetPilot).not.toHaveBeenCalled();
  expect(mockSyncPilot).not.toHaveBeenCalled();
}

describe('POST /api/onboarding/bootstrap-project existing-org hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUserForApi.mockResolvedValue({
      user: { id: USER, email: 'alex@example.com' },
      response: null,
    });
    mockGetOrganization.mockResolvedValue({ id: ORG });
    mockSettingsFindFirst.mockResolvedValue({ id: SETTINGS });
    mockGetOnboarding.mockResolvedValue(inProgress);
    mockPersistDeal.mockResolvedValue(undefined);
    mockFindOnboardingDealId.mockResolvedValue(undefined);
    mockRequireEntitlement.mockResolvedValue(null);
    mockOrgCreate.mockResolvedValue({ id: 'org-new', name: 'Workspace' });
    mockUserOrgCreate.mockResolvedValue({});
    mockSettingsCreate.mockResolvedValue({ id: 'ms-new' });
  });

  it('persists the project and merges in-progress onboarding without dropping omitted fields', async () => {
    const response = await bootstrapProject(
      request({
        projectName: 'Launch Event',
        defaultCurrency: 'AUD',
        existingProjectId: 'onb-deal-new',
      })
    );
    const json = (await response.json()) as {
      organizationId: string;
      merchantSettingsId: string | null;
      projectId: string;
    };

    expect(response.status).toBe(200);
    expect(json).toEqual(
      expect.objectContaining({
        organizationId: ORG,
        merchantSettingsId: SETTINGS,
        projectId: 'onb-deal-new',
      })
    );
    expectProjectPersistIsolated('onb-deal-new', {
      dealName: 'Launch Event',
      projectValueCurrency: 'AUD',
    });
    expect(mockFindOnboardingDealId).not.toHaveBeenCalled();
    expect(mockSaveOnboarding).toHaveBeenCalledWith(
      ORG,
      USER,
      expect.objectContaining({
        step: 'participants',
        projectId: 'onb-deal-new',
        organizationId: ORG,
        merchantSettingsId: SETTINGS,
        workspace_name: 'Northwind',
        workspace_industry: 'Events',
        workspace_team_size: '1–5',
        onboarding_use_case: 'event_settlement',
        onboarding_context: '{"source":"journey_assessment"}',
        collection_preference: 'decide_later',
      }),
      { skipIfEquivalent: true }
    );
    expect(mockOnboardingWrites).toHaveBeenCalledTimes(1);
    expectExistingOrgDidNotMutateWorkspaceIdentity();
    expectExistingOrgDidNotConverge(json);
  });

  it('does not start operational convergence for a new project on an existing org', async () => {
    const response = await bootstrapProject(
      request({
        projectName: 'Brand New Deal',
        defaultCurrency: 'AUD',
      })
    );
    const json = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(json.organizationId).toBe(ORG);
    expect(json.projectId).toEqual(expect.stringMatching(/^onb-deal-/));
    expectProjectPersistIsolated(json.projectId as string, { dealName: 'Brand New Deal' });
    expect(mockFindOnboardingDealId).toHaveBeenCalledWith(USER, 'Brand New Deal');
    expectExistingOrgDidNotConverge(json);
  });

  it('still gates a new agreement on an existing organization', async () => {
    await bootstrapProject(
      request({
        projectName: 'Brand New Deal',
        defaultCurrency: 'AUD',
      })
    );

    expect(mockRequireEntitlement).toHaveBeenCalledWith({
      organizationId: ORG,
      userId: USER,
      userEmail: 'alex@example.com',
      feature: 'create_agreement',
    });
    expect(mockPersistDeal).toHaveBeenCalled();
    expect(mockGetPilot).not.toHaveBeenCalled();
    expect(mockSyncPilot).not.toHaveBeenCalled();
  });

  it('keeps completed onboarding identity while still persisting the explicit project', async () => {
    mockGetOnboarding.mockResolvedValue(completed);

    const response = await bootstrapProject(
      request({
        projectName: 'Second Deal',
        defaultCurrency: 'USD',
        existingProjectId: 'onb-deal-second',
        onboarding_use_case: 'revenue_sharing',
        onboarding_context: 'should-not-rewind',
      })
    );
    const json = (await response.json()) as {
      organizationId: string;
      projectId: string;
    };

    expect(response.status).toBe(200);
    expect(json.organizationId).toBe(ORG);
    expect(json.projectId).toBe('onb-deal-second');
    expectProjectPersistIsolated('onb-deal-second', { dealName: 'Second Deal' });
    expect(mockOnboardingWrites).toHaveBeenCalledWith(
      ORG,
      USER,
      expect.objectContaining({
        step: 'complete',
        completed: true,
        completedAt: '2026-08-01T00:00:00.000Z',
        projectId: 'onb-deal-second',
        workspace_name: 'Northwind',
        onboarding_context: 'Event Settlement',
      })
    );
    const saved = mockOnboardingWrites.mock.calls[0][2] as OperatorOnboardingState;
    expect(saved.step).toBe('complete');
    expect(saved.completed).toBe(true);
    expect(saved.completedAt).toBe('2026-08-01T00:00:00.000Z');
    expect(saved.onboarding_context).toBe('Event Settlement');
    expectExistingOrgDidNotMutateWorkspaceIdentity();
    expectExistingOrgDidNotConverge(json);
  });

  it('does not start operational convergence when updating an existing project', async () => {
    const response = await bootstrapProject(
      request({
        projectName: 'Launch Event',
        defaultCurrency: 'AUD',
        existingProjectId: 'onb-deal-reuse',
      })
    );
    const json = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(json.projectId).toBe('onb-deal-reuse');
    expectProjectPersistIsolated('onb-deal-reuse', { dealName: 'Launch Event' });
    expect(mockFindOnboardingDealId).not.toHaveBeenCalled();
    expectExistingOrgDidNotConverge(json);
  });

  it('reuses the newest same-name onboarding deal without snapshot hydration', async () => {
    mockFindOnboardingDealId.mockResolvedValue('onb-deal-newest');

    const response = await bootstrapProject(
      request({
        projectName: 'Launch Event',
        defaultCurrency: 'AUD',
      })
    );
    const json = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(json.projectId).toBe('onb-deal-newest');
    expect(mockFindOnboardingDealId).toHaveBeenCalledWith(USER, 'Launch Event');
    expectProjectPersistIsolated('onb-deal-newest', { dealName: 'Launch Event' });
    expectExistingOrgDidNotConverge(json);
  });

  it('does not update merchant default_currency from the request', async () => {
    await bootstrapProject(
      request({
        projectName: 'Launch Event',
        defaultCurrency: 'AUD',
        existingProjectId: 'onb-deal-new',
      })
    );

    expect(mockSettingsFindFirst).toHaveBeenCalledWith({
      where: { organization_id: ORG },
      select: { id: true },
    });
    expect(mockSettingsUpdate).not.toHaveBeenCalled();
    expect(mockSettingsUpdateMany).not.toHaveBeenCalled();
    expectProjectPersistIsolated('onb-deal-new', { projectValueCurrency: 'AUD' });
  });

  it('does not invent a dummy merchant_settings row when none exists', async () => {
    mockSettingsFindFirst.mockResolvedValue(null);

    const response = await bootstrapProject(
      request({
        projectName: 'Launch Event',
        defaultCurrency: 'AUD',
        existingProjectId: 'onb-deal-new',
      })
    );
    const json = (await response.json()) as { merchantSettingsId: string | null };

    expect(response.status).toBe(200);
    expect(json.merchantSettingsId).toBeNull();
    expect(mockSettingsCreate).not.toHaveBeenCalled();
    expect(mockSettingsUpdate).not.toHaveBeenCalled();
    expect(mockSaveOnboarding).toHaveBeenCalledWith(
      ORG,
      USER,
      expect.objectContaining({
        merchantSettingsId: SETTINGS,
        projectId: 'onb-deal-new',
      }),
      { skipIfEquivalent: true }
    );
  });

  it('skips the onboarding-state write when the merged snapshot is equivalent', async () => {
    const alreadyMerged: OperatorOnboardingState = {
      ...inProgress,
      step: 'participants',
      projectId: 'onb-deal-same',
    };
    mockGetOnboarding.mockResolvedValue(alreadyMerged);

    const response = await bootstrapProject(
      request({
        projectName: 'Launch Event',
        defaultCurrency: 'AUD',
        existingProjectId: 'onb-deal-same',
      })
    );

    expect(response.status).toBe(200);
    expect(mockSaveOnboarding).toHaveBeenCalledWith(
      ORG,
      USER,
      alreadyMerged,
      { skipIfEquivalent: true }
    );
    expect(mockOnboardingWrites).not.toHaveBeenCalled();
    expectProjectPersistIsolated('onb-deal-same');
  });

  it('still initializes a genuine create from the request', async () => {
    mockGetOrganization.mockResolvedValue(null);

    const response = await bootstrapProject(
      request({
        projectName: 'First Agreement',
        defaultCurrency: 'USD',
        onboarding_use_case: 'event_settlement',
        onboarding_context: 'create-path',
        existingProjectId: 'onb-deal-create',
      })
    );
    const json = (await response.json()) as {
      organizationId: string;
      merchantSettingsId: string;
      projectId: string;
      correlationId?: string;
    };

    expect(response.status).toBe(201);
    expect(json.organizationId).toBe('org-new');
    expect(json.merchantSettingsId).toBe('ms-new');
    expect(json.projectId).toBe('onb-deal-create');
    expect(json.correlationId).toBe('corr-project');
    expect(mockConvergence).toHaveBeenCalledWith({
      userId: USER,
      organizationId: 'org-new',
      projectId: 'onb-deal-create',
      triggerSource: 'bootstrap-project',
      orchestrate: false,
    });
    expect(mockOrgCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Workspace',
        subscription_plan: 'professional',
        subscription_status: 'trialing',
        trial_ends_at: expect.any(Date),
      }),
    });
    expect(mockUserOrgCreate).toHaveBeenCalledWith({
      data: {
        user_id: USER,
        organization_id: 'org-new',
        role: 'OWNER',
      },
    });
    expect(mockSettingsCreate).toHaveBeenCalledWith({
      data: {
        organization_id: 'org-new',
        display_name: 'Workspace',
        default_currency: 'USD',
      },
    });
    expect(mockSaveOnboarding).toHaveBeenCalledWith(
      'org-new',
      USER,
      expect.objectContaining({
        step: 'participants',
        onboarding_use_case: 'event_settlement',
        onboarding_context: 'create-path',
        organizationId: 'org-new',
        merchantSettingsId: 'ms-new',
        projectId: 'onb-deal-create',
      })
    );
    expect(mockSaveOnboarding.mock.calls[0][3]).toBeUndefined();
    expect(mockOnboardingWrites).toHaveBeenCalledTimes(1);
    expectProjectPersistIsolated('onb-deal-create', { dealName: 'First Agreement' });
    expect(mockFindOnboardingDealId).not.toHaveBeenCalled();
    expect(mockRequireEntitlement).not.toHaveBeenCalled();
    expect(mockSettingsUpdate).not.toHaveBeenCalled();
  });
});

describe('bootstrap-project existing-org surface', () => {
  it('keeps existing-org from mutating workspace identity or replace-writing onboarding', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/api/onboarding/bootstrap-project/route.ts'),
      'utf8'
    );
    const reuse = source.slice(
      source.indexOf('if (existingOrg)'),
      source.indexOf("logBootstrap(operationId, 'new_org_path')")
    );

    expect(reuse).toContain('merchant_settings.findFirst');
    expect(reuse).toContain('mergeOperatorOnboardingState');
    expect(reuse).toContain('skipIfEquivalent: true');
    expect(reuse).toContain('getOperatorOnboardingState');
    expect(reuse).not.toContain('resolveOperatorOnboardingPatch');
    expect(reuse).not.toContain('merchant_settings.update');
    expect(reuse).not.toContain('merchant_settings.create');
    expect(reuse).not.toContain("display_name: 'Workspace'");
    expect(reuse).not.toContain('default_currency: body.defaultCurrency');
    expect(reuse).not.toContain('runOperationalInitializationConvergence');
    expect(source).toContain('journeyWorkspaceSubscriptionCreate');
    expect(source).toContain('createdWorkspace');
    expect(source).toContain('httpStatus === 201');
    expect(source).toContain('runOperationalInitializationConvergence');
    expect(source).toContain('persistPilotDealForUser');
    expect(source).toContain('findOnboardingDealIdByName');
    expect(source).not.toContain('getPilotSnapshotForUser');
    expect(source).not.toContain('syncPilotSnapshotForUser');
  });
});
