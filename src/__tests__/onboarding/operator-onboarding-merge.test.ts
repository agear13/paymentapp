import {
  applyCompletedOnboardingGuard,
  mergeOperatorOnboardingState,
  resolveOperatorOnboardingPatch,
} from '@/lib/onboarding/operator-onboarding-merge';
import type { OperatorOnboardingState } from '@/lib/onboarding/operator-onboarding-types';
import { operatorOnboardingStatesEquivalent } from '@/lib/onboarding/operator-onboarding.server';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    audit_logs: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

const completed: OperatorOnboardingState = {
  step: 'complete',
  completed: true,
  completedAt: '2026-08-01T00:00:00.000Z',
  projectId: 'deal-1',
  onboarding_context: 'Event Settlement',
  workspace_name: 'Northwind',
  workspace_industry: 'Events',
  workspace_team_size: '1–5',
  organizationId: 'org-1',
  merchantSettingsId: 'ms-1',
};

const inProgress: OperatorOnboardingState = {
  step: 'use_case',
  workspace_name: 'Northwind',
  workspace_industry: 'Events',
  onboarding_context: '{"source":"journey_assessment"}',
  organizationId: 'org-1',
  merchantSettingsId: 'ms-1',
};

describe('mergeOperatorOnboardingState', () => {
  it('preserves omitted identity and completion fields', () => {
    const merged = mergeOperatorOnboardingState(completed, {
      step: 'funding',
      collection_preference: 'decide_later',
    });

    expect(merged.completed).toBe(true);
    expect(merged.completedAt).toBe('2026-08-01T00:00:00.000Z');
    expect(merged.projectId).toBe('deal-1');
    expect(merged.onboarding_context).toBe('Event Settlement');
    expect(merged.workspace_name).toBe('Northwind');
    expect(merged.workspace_industry).toBe('Events');
    expect(merged.workspace_team_size).toBe('1–5');
    expect(merged.step).toBe('funding');
    expect(merged.collection_preference).toBe('decide_later');
  });

  it('uses the incoming snapshot when no current state exists', () => {
    expect(
      mergeOperatorOnboardingState(null, {
        step: 'use_case',
        workspace_name: 'Studio North',
        onboarding_context: '{"source":"journey_assessment"}',
      })
    ).toEqual({
      step: 'use_case',
      workspace_name: 'Studio North',
      onboarding_context: '{"source":"journey_assessment"}',
    });
  });

  it('clears pending_billing_plan when the patch sends null', () => {
    const merged = mergeOperatorOnboardingState(
      { ...inProgress, pending_billing_plan: 'professional' },
      { pending_billing_plan: null }
    );
    expect(merged.pending_billing_plan).toBeUndefined();
  });
});

describe('applyCompletedOnboardingGuard', () => {
  it('blocks a stale journey patch from rewinding a completed workspace', () => {
    const merged = mergeOperatorOnboardingState(completed, {
      step: 'use_case',
      onboarding_context: '{"source":"journey_assessment","objective":null,"business":null}',
      workspace_name: 'My Commercial OS',
    });
    const guarded = applyCompletedOnboardingGuard(completed, merged);

    expect(guarded.completed).toBe(true);
    expect(guarded.completedAt).toBe(completed.completedAt);
    expect(guarded.step).toBe('complete');
    expect(guarded.projectId).toBe('deal-1');
    expect(guarded.onboarding_context).toBe('Event Settlement');
    expect(guarded.workspace_name).toBe('My Commercial OS');
  });

  it('lets in-progress onboarding apply explicit fields', () => {
    const resolved = resolveOperatorOnboardingPatch(inProgress, {
      step: 'funding',
      collection_preference: 'invoices',
    });
    expect(resolved.step).toBe('funding');
    expect(resolved.collection_preference).toBe('invoices');
    expect(resolved.workspace_name).toBe('Northwind');
    expect(resolved.onboarding_context).toBe('{"source":"journey_assessment"}');
  });

  it('treats a completed-guarded stale patch as equivalent to the current snapshot for locked fields', () => {
    const resolved = resolveOperatorOnboardingPatch(completed, {
      step: 'use_case',
      onboarding_context: '{"source":"journey_assessment"}',
    });
    expect(
      operatorOnboardingStatesEquivalent(completed, {
        ...completed,
        ...resolved,
        completed: true,
        completedAt: completed.completedAt,
        step: 'complete',
        projectId: completed.projectId,
        onboarding_context: completed.onboarding_context,
      })
    ).toBe(true);
    expect(operatorOnboardingStatesEquivalent(completed, resolved)).toBe(true);
  });
});

describe('existing server merge callers', () => {
  it('participants and complete-after-billing still spread the previous snapshot', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    const root = process.cwd();
    const participants = readFileSync(
      join(root, 'app/api/onboarding/participants/route.ts'),
      'utf8'
    );
    const billing = readFileSync(
      join(root, 'app/api/onboarding/complete-after-billing/route.ts'),
      'utf8'
    );
    expect(participants).toContain('...prev');
    expect(participants).toContain('getOperatorOnboardingState');
    expect(billing).toContain('...rest');
    expect(billing).toContain('getOperatorOnboardingState');
  });
});
