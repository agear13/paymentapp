import { describe, expect, it } from '@jest/globals';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  classifyTrackedOnboardingParty,
  logOnboardingPipelineDemoParticipants,
  logOnboardingPipelineDrafts,
  snapDemoParticipant,
  snapDraftParticipant,
  startOnboardingPipelineSession,
  getActiveOnboardingPipelineSession,
} from '@/lib/ai-extractor/onboarding-pipeline-instrumentation';

function islandParticipant(): DemoParticipant {
  return {
    id: 'p-island',
    dealId: 'deal-1',
    name: 'Island DJs',
    email: '',
    role: 'Performer',
    participationModel: 'fixed_payout',
    commissionKind: 'fixed',
    commissionValue: 2500,
    inviteToken: 'tok',
    approvalStatus: 'Pending approval',
    compensationProfile: {
      compensationType: 'FIXED_FEE',
      fixedAmount: 2500,
      configured: true,
      configuredAt: '2026-01-01T00:00:00.000Z',
    },
  } as DemoParticipant;
}

describe('onboarding-pipeline-instrumentation', () => {
  it('detects first loss when draft POST strips compensation fields', () => {
    startOnboardingPipelineSession('test');
    logOnboardingPipelineDemoParticipants('mapReviewToParticipants', [islandParticipant()]);
    logOnboardingPipelineDrafts('clientPostPayload', [
      { name: 'Island DJs', email: '', role: 'Performer' },
    ]);
    const session = getActiveOnboardingPipelineSession();
    expect(session?.firstLossInSession.islandDjsFixedAmount2500).toBe('clientPostPayload');
  });

  it('snapDraftParticipant has null profile', () => {
    const snap = snapDraftParticipant({ name: 'Island DJs', role: 'Performer' });
    expect(snap.compensationProfile).toBeNull();
    expect(classifyTrackedOnboardingParty('Coastal Promotions')).toBe('coastal_promotions');
  });

  it('snapDemoParticipant preserves fixed amount', () => {
    const snap = snapDemoParticipant(islandParticipant());
    expect(snap.compensationProfile?.fixedAmount).toBe(2500);
  });
});
