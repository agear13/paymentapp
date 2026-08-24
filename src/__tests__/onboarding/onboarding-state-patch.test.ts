import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/api-session.server', () => ({
  getCurrentUserForApi: jest.fn(),
}));

jest.mock('@/lib/auth/get-org', () => ({
  getOrganizationForAuthenticatedUser: jest.fn(),
}));

const mockGetState = jest.fn();
const mockSaveState = jest.fn().mockResolvedValue(true);

jest.mock('@/lib/onboarding/operator-onboarding.server', () => ({
  getOperatorOnboardingState: (...args: unknown[]) => mockGetState(...args),
  saveOperatorOnboardingState: (...args: unknown[]) => mockSaveState(...args),
}));

const mockResume = jest.fn().mockResolvedValue({ snapshot: {} });

jest.mock('@/lib/operations/onboarding/run-operational-initialization-convergence.server', () => ({
  resumeOperationalInitialization: (...args: unknown[]) => mockResume(...args),
}));

import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { PATCH as patchOnboarding } from '@/app/api/onboarding/route';
import type { OperatorOnboardingState } from '@/lib/onboarding/operator-onboarding-types';

const mockGetCurrentUserForApi = getCurrentUserForApi as jest.Mock;
const mockGetOrganization = getOrganizationForAuthenticatedUser as jest.Mock;

const ORG = '11111111-1111-4111-8111-111111111111';

const completed: OperatorOnboardingState = {
  step: 'complete',
  completed: true,
  completedAt: '2026-08-01T00:00:00.000Z',
  projectId: 'deal-1',
  onboarding_context: 'Event Settlement',
  workspace_name: 'Northwind',
  organizationId: ORG,
  merchantSettingsId: 'ms-1',
};

const inProgress: OperatorOnboardingState = {
  step: 'use_case',
  workspace_name: 'Northwind',
  workspace_industry: 'Events',
  onboarding_context: '{"source":"journey_assessment"}',
  organizationId: ORG,
  merchantSettingsId: 'ms-1',
};

function patchRequest(state: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/onboarding', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationId: ORG, state }),
  });
}

describe('PATCH /api/onboarding merge and completed guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUserForApi.mockResolvedValue({
      user: { id: 'user-1', email: 'alex@example.com' },
      response: null,
    });
    mockGetOrganization.mockResolvedValue({ id: ORG });
    mockSaveState.mockResolvedValue(true);
  });

  it('merges explicit fields and keeps omitted project/completion/context/name', async () => {
    mockGetState.mockResolvedValue(inProgress);

    const response = await patchOnboarding(
      patchRequest({
        step: 'funding',
        collection_preference: 'decide_later',
      })
    );

    expect(response.status).toBe(200);
    expect(mockSaveState).toHaveBeenCalledWith(
      ORG,
      'user-1',
      {
        ...inProgress,
        step: 'funding',
        collection_preference: 'decide_later',
      },
      { skipIfEquivalent: true }
    );
    expect(mockResume).not.toHaveBeenCalled();
  });

  it('does not rewind a completed workspace from a stale journey patch', async () => {
    mockGetState.mockResolvedValue(completed);
    mockSaveState.mockResolvedValue(false);

    const response = await patchOnboarding(
      patchRequest({
        step: 'use_case',
        workspace_name: 'My Commercial OS',
        onboarding_context: '{"source":"journey_assessment","objective":null,"business":null}',
      })
    );

    expect(response.status).toBe(200);
    const saved = mockSaveState.mock.calls[0]?.[2] as OperatorOnboardingState;
    expect(saved.completed).toBe(true);
    expect(saved.completedAt).toBe(completed.completedAt);
    expect(saved.step).toBe('complete');
    expect(saved.projectId).toBe('deal-1');
    expect(saved.onboarding_context).toBe('Event Settlement');
    expect(mockResume).not.toHaveBeenCalled();
  });

  it('writes the initial snapshot when no current state exists', async () => {
    mockGetState.mockResolvedValue(null);

    await patchOnboarding(
      patchRequest({
        step: 'use_case',
        workspace_name: 'Studio North',
        onboarding_context: '{"source":"journey_assessment"}',
        organizationId: ORG,
        merchantSettingsId: '22222222-2222-4222-8222-222222222222',
      })
    );

    expect(mockSaveState).toHaveBeenCalledWith(
      ORG,
      'user-1',
      {
        step: 'use_case',
        workspace_name: 'Studio North',
        onboarding_context: '{"source":"journey_assessment"}',
        organizationId: ORG,
        merchantSettingsId: '22222222-2222-4222-8222-222222222222',
      },
      { skipIfEquivalent: true }
    );
  });
});
