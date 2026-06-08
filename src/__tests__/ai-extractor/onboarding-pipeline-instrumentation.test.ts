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
import { onboardingDraftsFromExtraction } from '@/lib/onboarding/onboarding-participant-persist';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';

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

  it('onboardingDraftsFromExtraction preserves compensation (remediation path)', () => {
    const deal: RecentDeal = {
      id: 'deal-1',
      dealName: 'Event',
      partner: 'Venue',
      value: 0,
      introducer: '',
      closer: '',
      status: 'Pending',
      lastUpdated: '2026-01-01T00:00:00.000Z',
      paymentStatus: 'Not Paid',
      projectValueCurrency: 'AUD',
    };
    const result = {
      projectName: { value: 'Event', confidence: 'high' as const },
      projectDescription: { value: null, confidence: 'absent' as const },
      projectValue: { value: null, confidence: 'absent' as const },
      currency: { value: 'AUD', confidence: 'high' as const },
      counterparty: { value: null, confidence: 'absent' as const },
      parties: [
        {
          id: 'ep-1',
          name: { value: 'Island DJs', confidence: 'high' as const },
          email: { value: null, confidence: 'absent' as const },
          role: { value: 'Contractor', confidence: 'high' as const },
          participationModel: { value: 'fixed_payout' as const, confidence: 'high' as const },
          fixedAmount: { value: 2500, confidence: 'high' as const },
          revenueSharePct: { value: null, confidence: 'absent' as const },
          notes: { value: null, confidence: 'absent' as const },
        },
      ],
      paymentTerms: [],
      uncertainties: [],
      overallConfidence: 'high' as const,
      sourceHint: 'whatsapp',
      extractedAt: '2026-01-01T00:00:00.000Z',
    } satisfies ExtractionResult;
    const drafts = onboardingDraftsFromExtraction(result, deal, 'whatsapp', 'AUD');
    expect(drafts[0]?.compensationProfile?.fixedAmount).toBe(2500);
  });

  it('snapDemoParticipant preserves fixed amount', () => {
    const snap = snapDemoParticipant(islandParticipant());
    expect(snap.compensationProfile?.fixedAmount).toBe(2500);
  });
});
