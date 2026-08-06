import {
  operatorOnboardingStatesEquivalent,
  saveOperatorOnboardingState,
  getOperatorOnboardingState,
} from '@/lib/onboarding/operator-onboarding.server';
import type { OperatorOnboardingState } from '@/lib/onboarding/operator-onboarding-types';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    audit_logs: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/server/prisma';

const prismaMock = prisma as unknown as {
  audit_logs: {
    findFirst: jest.Mock;
    create: jest.Mock;
  };
};

describe('operator onboarding persistence idempotency', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('detects equivalent onboarding snapshots', () => {
    const state: OperatorOnboardingState = {
      step: 'use_case',
      workspace_name: 'Professional services',
      onboarding_context: '{"source":"journey_assessment"}',
      organizationId: 'org-1',
    };

    expect(operatorOnboardingStatesEquivalent(state, { ...state })).toBe(true);
    expect(
      operatorOnboardingStatesEquivalent(state, {
        ...state,
        onboarding_context: '{"source":"journey_assessment","objective":"other"}',
      })
    ).toBe(false);
  });

  it('skips duplicate audit log writes when state is unchanged', async () => {
    const state: OperatorOnboardingState = {
      step: 'use_case',
      workspace_name: 'Professional services',
      organizationId: 'org-1',
    };

    prismaMock.audit_logs.findFirst.mockResolvedValueOnce({
      new_values: state,
    });

    const persisted = await saveOperatorOnboardingState('org-1', 'user-1', state, {
      skipIfEquivalent: true,
    });

    expect(persisted).toBe(false);
    expect(prismaMock.audit_logs.create).not.toHaveBeenCalled();
  });

  it('persists when onboarding state changes', async () => {
    const current: OperatorOnboardingState = {
      step: 'use_case',
      workspace_name: 'Old name',
      organizationId: 'org-1',
    };
    const next: OperatorOnboardingState = {
      step: 'use_case',
      workspace_name: 'Professional services',
      organizationId: 'org-1',
    };

    prismaMock.audit_logs.findFirst.mockResolvedValueOnce({ new_values: current });

    const persisted = await saveOperatorOnboardingState('org-1', 'user-1', next, {
      skipIfEquivalent: true,
    });

    expect(persisted).toBe(true);
    expect(prismaMock.audit_logs.create).toHaveBeenCalledTimes(1);
  });

  it('loads the latest onboarding snapshot', async () => {
    const state: OperatorOnboardingState = {
      step: 'use_case',
      workspace_name: 'Professional services',
      organizationId: 'org-1',
    };

    prismaMock.audit_logs.findFirst.mockResolvedValueOnce({ new_values: state });

    await expect(getOperatorOnboardingState('org-1')).resolves.toEqual(state);
  });
});
