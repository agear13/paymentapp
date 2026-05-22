import {
  buildOperationalGuidance,
  explainOperationalReadiness,
  deriveNextOperationalActions,
  deriveReleaseConfidence,
  explainProjectState,
} from '@/lib/operations/explainability';
import { defaultWorkspaceContext } from '@/lib/operations/types/operational-context';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

function baseParticipant(): DemoParticipant {
  return {
    id: 'p1',
    name: 'DJ Alex',
    email: '',
    role: 'Contributor',
    commissionKind: 'fixed_amount',
    commissionValue: 0,
    status: 'Pending',
    inviteStatus: 'Invited',
    approvalStatus: 'Pending approval',
    onboardingStatus: 'NOT_STARTED',
    inviteToken: 'tok',
    workspaceSource: 'project',
  };
}

describe('explainOperationalReadiness', () => {
  it('never returns generic not ready without bullets', () => {
    const ctx = {
      ...defaultWorkspaceContext(),
      hasOrganization: true,
      onboardingCompleted: true,
      projectCount: 1,
      participantCount: 2,
      participantsConfiguredCount: 0,
      stripeConfigured: true,
      primaryProjectId: 'proj-1',
    };
    const result = explainOperationalReadiness({ workspace: ctx });
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.explainability.headline).toMatch(/blocked|progressing|Setup/i);
    expect(result.explainability.bullets.length).toBeGreaterThan(0);
  });
});

describe('deriveNextOperationalActions', () => {
  it('prioritizes compensation before obligations', () => {
    const ctx = {
      ...defaultWorkspaceContext(),
      hasOrganization: true,
      participantCount: 2,
      participantsConfiguredCount: 0,
      primaryProjectId: 'proj-1',
      stripeConfigured: true,
    };
    const explanation = explainOperationalReadiness({ workspace: ctx });
    const actions = deriveNextOperationalActions(explanation, ctx);
    expect(actions[0]?.id).toBe('configure-earnings');
    expect(actions[0]?.urgency).toBe('critical');
  });
});

describe('deriveReleaseConfidence', () => {
  it('returns BLOCKED without provider', () => {
    const snap = deriveReleaseConfidence({
      workspace: { ...defaultWorkspaceContext(), participantCount: 1 },
      participants: [baseParticipant()],
    });
    expect(snap.level).toBe('BLOCKED');
    expect(snap.explainability.bullets.length).toBeGreaterThan(0);
  });
});

describe('buildOperationalGuidance', () => {
  it('never throws on empty input', () => {
    const bundle = buildOperationalGuidance({ workspace: defaultWorkspaceContext() });
    expect(bundle.stateExplanation).not.toBeNull();
    expect(bundle.trustSignals.length).toBeGreaterThan(0);
    expect(bundle.actions.length).toBeGreaterThanOrEqual(0);
  });
});

describe('state explanations', () => {
  it('explains FUNDING_PENDING with four sections', () => {
    const exp = explainProjectState('FUNDING_PENDING', ['Invoice unpaid']);
    expect(exp.whatThisMeans).toContain('revenue');
    expect(exp.whyItMatters).toBeTruthy();
    expect(exp.whatUnlocksNext).toBeTruthy();
    expect(exp.blockingProgress).toContain('Invoice unpaid');
  });
});
