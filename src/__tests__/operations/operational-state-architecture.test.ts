import {
  canTransitionWorkspaceState,
  canTransitionProjectState,
  canTransitionParticipantState,
} from '@/lib/operations/transitions';
import {
  deriveWorkspaceOperationalHealth,
  deriveParticipantPayoutReadiness,
  deriveReleaseEligibility,
} from '@/lib/operations/readiness';
import {
  orchestrateOperations,
  deriveWorkspaceActivationFromOperations,
} from '@/lib/operations';
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

describe('operations transitions', () => {
  it('allows workspace DRAFT -> CONFIGURING', () => {
    expect(canTransitionWorkspaceState('DRAFT', 'CONFIGURING')).toBe(true);
  });

  it('allows project BLOCKED from CONFIGURING', () => {
    expect(canTransitionProjectState('CONFIGURING', 'BLOCKED')).toBe(true);
  });

  it('allows participant COMPENSATION_PENDING -> READY', () => {
    expect(canTransitionParticipantState('COMPENSATION_PENDING', 'READY')).toBe(true);
  });
});

describe('workspace operational health', () => {
  it('returns DEGRADED when provider connected but compensation missing', () => {
    const health = deriveWorkspaceOperationalHealth({
      ...defaultWorkspaceContext(),
      hasOrganization: true,
      onboardingCompleted: true,
      projectCount: 1,
      participantCount: 2,
      participantsConfiguredCount: 0,
      stripeConfigured: true,
      primaryProjectId: 'proj-1',
    });
    expect(health.state).toBe('DEGRADED');
    expect(health.blockers.length).toBeGreaterThan(0);
    expect(health.needsGuidance).toBe(true);
  });
});

describe('participant payout readiness', () => {
  it('is not payout-ready without compensation', () => {
    const r = deriveParticipantPayoutReadiness(baseParticipant());
    expect(r.payoutReady).toBe(false);
    expect(r.flags.hasCompensation).toBe(false);
    expect(r.issues).toContain('Compensation structure missing');
  });
});

describe('operational orchestrator', () => {
  it('never throws on empty context', () => {
    const snap = orchestrateOperations({ workspace: defaultWorkspaceContext() });
    expect(snap.needsGuidance).toBe(true);
    expect(snap.degraded).toBe(false);
  });

  it('bridges to legacy activation snapshot', () => {
    const activation = deriveWorkspaceActivationFromOperations({
      hasOrganization: true,
      onboardingCompleted: true,
      projectCreated: true,
      participantCount: 1,
      participantsConfigured: false,
      participantsConfiguredCount: 0,
      obligationCount: 0,
      paymentLinkCount: 0,
      collectionPreferenceDecideLater: false,
      defaultCurrency: 'AUD',
      stripeConfigured: true,
      wiseConfigured: false,
      hederaConfigured: false,
      releaseEligibleCount: 0,
      releaseBatchCount: 0,
      primaryProjectId: 'proj-1',
    });
    expect(activation.needsGuidance).toBe(true);
    expect(activation.providerConnected).toBe(true);
    expect(activation.participantsConfigured).toBe(false);
  });
});

describe('release eligibility', () => {
  it('blocks release when compensation incomplete', () => {
    const r = deriveReleaseEligibility({
      ...defaultWorkspaceContext(),
      participantCount: 1,
      participantsConfiguredCount: 0,
      obligationCount: 1,
      releaseEligibleCount: 1,
      stripeConfigured: true,
    });
    expect(r.canCreateRelease).toBe(false);
  });
});
