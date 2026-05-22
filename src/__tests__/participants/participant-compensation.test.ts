import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  evaluateWorkspaceCompensationReadiness,
  isCompensationConfigured,
} from '@/lib/participants/participant-compensation';
import {
  deriveParticipantReadiness,
  summarizeProjectReadinessGaps,
} from '@/lib/participants/participant-readiness';
import { deriveNextRecommendedAction } from '@/lib/onboarding/next-recommended-action';
import { deriveWorkspaceActivation } from '@/lib/onboarding/workspace-activation-state';

function baseParticipant(overrides: Partial<DemoParticipant> = {}): DemoParticipant {
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
    inviteToken: 'tok-1',
    workspaceSource: 'project',
    participationModel: 'fixed_payout',
    ...overrides,
  };
}

describe('participant compensation readiness', () => {
  it('treats onboarding placeholder as not configured', () => {
    expect(isCompensationConfigured(baseParticipant())).toBe(false);
  });

  it('treats saved profile as configured', () => {
    expect(
      isCompensationConfigured(
        baseParticipant({
          compensationProfile: {
            compensationType: 'REVENUE_SHARE',
            percentage: 15,
            configured: true,
          },
        })
      )
    ).toBe(true);
  });

  it('reports compensation missing on readiness', () => {
    const r = deriveParticipantReadiness(baseParticipant({ name: 'Elite Beverages' }));
    expect(r.primaryIssue).toMatch(/Compensation|missing/i);
  });

  it('evaluates workspace compensation gate', () => {
    const readiness = evaluateWorkspaceCompensationReadiness([
      baseParticipant(),
      baseParticipant({
        id: 'p2',
        compensationProfile: {
          compensationType: 'FIXED_FEE',
          fixedAmount: 5000,
          configured: true,
        },
      }),
    ]);
    expect(readiness.participantsConfigured).toBe(false);
    expect(readiness.configuredCount).toBe(1);
  });

  it('does not treat zero participants as compensation configured', () => {
    const readiness = evaluateWorkspaceCompensationReadiness([]);
    expect(readiness.participantsConfigured).toBe(false);
    expect(readiness.participantCount).toBe(0);
  });
});

describe('next recommended action order', () => {
  it('recommends configure earnings after provider when compensation missing', () => {
    const activation = deriveWorkspaceActivation({
      hasOrganization: true,
      onboardingCompleted: true,
      projectCreated: true,
      participantCount: 2,
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
    const next = deriveNextRecommendedAction(activation);
    expect(next.id).toBe('compensation');
    expect(activation.needsGuidance).toBe(true);
    expect(next.title).toContain('Configure participant earnings');
  });

  it('does not recommend obligations before compensation', () => {
    const activation = deriveWorkspaceActivation({
      hasOrganization: true,
      onboardingCompleted: true,
      projectCreated: true,
      participantCount: 1,
      participantsConfigured: false,
      participantsConfiguredCount: 0,
      obligationCount: 0,
      paymentLinkCount: 1,
      collectionPreferenceDecideLater: false,
      defaultCurrency: 'AUD',
      stripeConfigured: true,
      wiseConfigured: false,
      hederaConfigured: false,
      releaseEligibleCount: 0,
      releaseBatchCount: 0,
      primaryProjectId: 'proj-1',
    });
    const next = deriveNextRecommendedAction(activation);
    expect(next.id).not.toBe('obligations');
  });
});

describe('project readiness gaps', () => {
  it('summarizes missing compensation structures', () => {
    const gaps = summarizeProjectReadinessGaps([baseParticipant(), baseParticipant({ id: 'p2' })]);
    expect(gaps.gapLabels).toContain('Compensation structures');
    expect(gaps.payoutReadyCount).toBe(0);
  });
});
