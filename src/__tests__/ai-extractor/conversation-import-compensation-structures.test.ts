/**
 * Conversation import → earnings persistence by compensation structure.
 */
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { ExtractionResult, ExtractedParty } from '@/lib/ai-extractor/extraction-types';
import { reviewFormFromExtraction } from '@/lib/ai-extractor/review-form-types';
import { mapSinglePartyToParticipant } from '@/lib/ai-extractor/extraction-mapper';
import {
  getPartyCompensationWarnings,
  isHybridCompensationParty,
  validateReviewFormCompensation,
} from '@/lib/ai-extractor/compensation-review-validation';
import { hydrateParticipant } from '@/lib/operations/hydration/hydrate-participant';
import { hasPersistedCompensationTerms } from '@/lib/operations/primitives/participant-earnings-primitives';
import { isParticipantEarningsConfigured } from '@/lib/operations/selectors/participant-earnings-selectors';
import { deriveCompensationState } from '@/lib/operations/derivations/derive-compensation-state';

function field<T>(value: T, confidence: 'high' | 'medium' | 'low' | 'absent' = 'high') {
  return { value, confidence };
}

function baseDeal(currency: 'AUD' | 'USD' = 'AUD'): RecentDeal {
  return {
    id: 'deal-comp-investigation',
    dealName: 'Compensation Investigation Event',
    partner: 'Venue',
    value: 50_000,
    introducer: '',
    closer: '',
    status: 'Pending',
    lastUpdated: '2026-05-20T10:00:00.000Z',
    paymentStatus: 'Not Paid',
    projectValueCurrency: currency,
  };
}

function buildExtractionResult(input: {
  currency?: string | null;
  party: ExtractedParty;
}): ExtractionResult {
  return {
    projectName: field('Compensation Investigation Event'),
    projectDescription: field(null),
    projectValue: field(50_000),
    currency: field(input.currency ?? 'AUD'),
    counterparty: field(null),
    parties: [input.party],
    paymentTerms: [],
    uncertainties: [],
    overallConfidence: 'high',
    sourceHint: 'whatsapp',
    extractedAt: '2026-06-02T12:00:00.000Z',
  };
}

/** Simulates participant_payload round-trip through syncPilotSnapshot / DB reload. */
function simulateParticipantPayloadPersist(participant: DemoParticipant): DemoParticipant {
  return JSON.parse(JSON.stringify(participant)) as DemoParticipant;
}

export type CompensationStructureTrace = {
  label: string;
  conversationSnippet: string;
  saveBlocked: boolean;
  reviewParty: {
    participationModel: string;
    fixedAmount: number | null;
    revenueSharePct: number | null;
  };
  profileCreated: boolean;
  profileType: string | null | undefined;
  profilePercentage: number | null | undefined;
  profileFixedAmount: number | null | undefined;
  profileConfigured: boolean | null | undefined;
  persistedProfileIntact: boolean;
  hasPersistedTermsRaw: boolean;
  hasPersistedTermsHydrated: boolean;
  earningsConfigured: boolean;
  earningsPrimaryCompact: string;
  settlementBasis: string;
  failureStage: string | null;
  isHybridDetected: boolean;
};

function traceCompensationStructure(input: {
  label: string;
  conversationSnippet: string;
  result: ExtractionResult;
  workspaceCurrency?: string;
}): CompensationStructureTrace {
  const original = input.result.parties[0]!;
  const form = reviewFormFromExtraction(
    input.result,
    'participant_add',
    'whatsapp',
    undefined,
    { workspaceCurrency: input.workspaceCurrency ?? 'AUD' }
  );
  const reviewed = form.parties[0]!;
  const originalsById = new Map([[original.id, original]]);
  const saveBlocked = validateReviewFormCompensation(form.parties, originalsById).length > 0;

  const mapped = mapSinglePartyToParticipant(reviewed, baseDeal(), '[AI Import]', original);

  const persisted = simulateParticipantPayloadPersist(mapped);
  const hydratedEntity = hydrateParticipant(persisted)._entity;
  const compensation = deriveCompensationState(hydratedEntity);

  const profile = mapped.compensationProfile;
  const persistedProfile = persisted.compensationProfile;

  let failureStage: string | null = null;
  if (saveBlocked) failureStage = 'review_validation';
  else if (!profile) failureStage = 'compensation_profile_creation';
  else if (!persistedProfile?.configured && !persistedProfile?.compensationType) {
    failureStage = 'persistence';
  } else if (!hasPersistedCompensationTerms(persisted)) failureStage = 'persistence';
  else if (!hasPersistedCompensationTerms(hydratedEntity)) failureStage = 'hydration';
  else if (!isParticipantEarningsConfigured(hydratedEntity)) failureStage = 'ui_derivation';
  else if (
    compensation.earningsPrimaryCompact === 'Needs review' ||
    compensation.earningsPrimaryCompact === 'Not configured' ||
    compensation.earningsPrimaryCompact === 'Earnings not configured'
  ) {
    failureStage = 'ui_derivation';
  }

  return {
    label: input.label,
    conversationSnippet: input.conversationSnippet,
    saveBlocked,
    reviewParty: {
      participationModel: reviewed.participationModel,
      fixedAmount: reviewed.fixedAmount,
      revenueSharePct: reviewed.revenueSharePct,
    },
    profileCreated: profile != null,
    profileType: profile?.compensationType,
    profilePercentage: profile?.percentage,
    profileFixedAmount: profile?.fixedAmount,
    profileConfigured: profile?.configured,
    persistedProfileIntact:
      persistedProfile?.compensationType === profile?.compensationType &&
      persistedProfile?.configured === profile?.configured,
    hasPersistedTermsRaw: hasPersistedCompensationTerms(persisted),
    hasPersistedTermsHydrated: hasPersistedCompensationTerms(hydratedEntity),
    earningsConfigured: isParticipantEarningsConfigured(hydratedEntity),
    earningsPrimaryCompact: compensation.earningsPrimaryCompact,
    settlementBasis: compensation.settlementBasis,
    failureStage,
    isHybridDetected: isHybridCompensationParty(reviewed, original),
  };
}

describe('conversation import compensation structures — pipeline investigation', () => {
  describe('A. Fixed payout — "We\'ll pay you $500 for the event."', () => {
    const party: ExtractedParty = {
      id: 'ep-fixed',
      name: field('Alex'),
      email: field(''),
      role: field('Contractor'),
      participationModel: field('fixed_payout'),
      fixedAmount: field(500),
      revenueSharePct: field(null, 'absent'),
      notes: field(null),
    };
    const result = buildExtractionResult({ currency: 'AUD', party });
    const trace = traceCompensationStructure({
      label: 'A_fixed_payout_aud',
      conversationSnippet: "We'll pay you $500 for the event.",
      result,
    });

    it('review → map → persist → hydrate: configured fixed fee', () => {
      expect(trace.saveBlocked).toBe(false);
      expect(trace.reviewParty.fixedAmount).toBe(500);
      expect(trace.profileCreated).toBe(true);
      expect(trace.profileType).toBe('FIXED_FEE');
      expect(trace.profileFixedAmount).toBe(500);
      expect(trace.persistedProfileIntact).toBe(true);
      expect(trace.hasPersistedTermsRaw).toBe(true);
      expect(trace.hasPersistedTermsHydrated).toBe(true);
      expect(trace.earningsConfigured).toBe(true);
      expect(trace.earningsPrimaryCompact).not.toBe('Needs review');
      expect(trace.earningsPrimaryCompact).not.toBe('Earnings not configured');
      expect(trace.failureStage).toBeNull();
    });
  });

  describe('A-variant. Fixed payout — IDR conversation (resolver falls back to AUD)', () => {
    const party: ExtractedParty = {
      id: 'ep-fixed-idr',
      name: field('Alex'),
      email: field(''),
      role: field('Contractor'),
      participationModel: field('fixed_payout'),
      fixedAmount: field(15_000_000, 'high'),
      revenueSharePct: field(null, 'absent'),
      notes: field(null),
    };
    const result = buildExtractionResult({ currency: 'IDR', party });
    const trace = traceCompensationStructure({
      label: 'A_fixed_payout_idr',
      conversationSnippet: 'Fee 15M IDR for the event',
      result,
      workspaceCurrency: 'AUD',
    });

    it('review nulls fixed amount; save blocked until AUD/USD conversion; no FIXED_FEE profile', () => {
      expect(trace.reviewParty.fixedAmount).toBeNull();
      expect(trace.reviewParty.participationModel).toBe('fixed_payout');
      expect(trace.saveBlocked).toBe(true);
      expect(trace.profileCreated).toBe(false);
      expect(trace.profileType).toBeUndefined();
      expect(trace.earningsConfigured).toBe(false);
      expect(trace.failureStage).toBe('review_validation');
    });
  });

  describe('A-fail. Fixed payout — amount absent after extraction', () => {
    const party: ExtractedParty = {
      id: 'ep-fixed-missing',
      name: field('Alex'),
      email: field(''),
      role: field('Contractor'),
      participationModel: field('fixed_payout', 'medium'),
      fixedAmount: field(null, 'absent'),
      revenueSharePct: field(null, 'absent'),
      notes: field(null),
    };
    const result = buildExtractionResult({ party });
    const trace = traceCompensationStructure({
      label: 'A_fixed_missing_amount',
      conversationSnippet: "We'll pay you for the event.",
      result,
    });

    it('save blocked; mapped without profile → Needs review / not configured', () => {
      expect(trace.saveBlocked).toBe(true);
      expect(trace.profileCreated).toBe(false);
      expect(trace.hasPersistedTermsHydrated).toBe(false);
      expect(trace.earningsPrimaryCompact).toBe('Needs review');
      expect(trace.failureStage).toBe('review_validation');
    });
  });

  describe('B. Revenue share — "We\'ll pay 10% of ticket revenue."', () => {
    const party: ExtractedParty = {
      id: 'ep-rev',
      name: field('Sarah'),
      email: field(''),
      role: field('Referrer'),
      participationModel: field('revenue_share'),
      fixedAmount: field(null, 'absent'),
      revenueSharePct: field(10, 'high'),
      notes: field(null),
    };
    const result = buildExtractionResult({ party });
    const trace = traceCompensationStructure({
      label: 'B_revenue_share',
      conversationSnippet: "We'll pay 10% of ticket revenue.",
      result,
    });

    it('full pipeline succeeds with REVENUE_SHARE profile', () => {
      expect(trace.saveBlocked).toBe(false);
      expect(trace.profileType).toBe('REVENUE_SHARE');
      expect(trace.profilePercentage).toBe(10);
      expect(trace.hasPersistedTermsHydrated).toBe(true);
      expect(trace.earningsConfigured).toBe(true);
      expect(trace.earningsPrimaryCompact).toBe('10% revenue share');
      expect(trace.settlementBasis).toBe('project_settlement_allocation');
      expect(trace.failureStage).toBeNull();
    });
  });

  describe('B-fail. Revenue share — percentage absent in extraction', () => {
    const party: ExtractedParty = {
      id: 'ep-rev-missing',
      name: field('DJs'),
      email: field(''),
      role: field('Contractor'),
      participationModel: field('revenue_share', 'medium'),
      fixedAmount: field(null, 'absent'),
      revenueSharePct: field(null, 'absent'),
      notes: field(null),
    };
    const result = buildExtractionResult({ party });
    const trace = traceCompensationStructure({
      label: 'B_revenue_share_missing_pct',
      conversationSnippet: 'Share of ticket sales',
      result,
    });

    it('save blocked at review; if forced map → Needs review', () => {
      expect(getPartyCompensationWarnings(
        { id: party.id, name: 'DJs', email: '', role: 'Contractor', participationModel: 'revenue_share', fixedAmount: null, revenueSharePct: null, notes: '' },
        party
      )[0]?.kind).toBe('revenue_share_missing_pct');
      expect(trace.saveBlocked).toBe(true);
      const forced = traceCompensationStructure({
        label: 'forced',
        conversationSnippet: '',
        result,
      });
      expect(forced.profileCreated).toBe(false);
    });
  });

  describe('C. Customer attribution — "15% of bookings you refer."', () => {
    const party: ExtractedParty = {
      id: 'ep-attr',
      name: field('Promoter'),
      email: field(''),
      role: field('Referrer'),
      participationModel: field('customer_attribution'),
      fixedAmount: field(null, 'absent'),
      revenueSharePct: field(15, 'high'),
      notes: field(null),
    };
    const result = buildExtractionResult({ party });
    const trace = traceCompensationStructure({
      label: 'C_customer_attribution',
      conversationSnippet: "You'll receive 15% of bookings you refer.",
      result,
    });

    it('profile created as COMMISSION with 15% persisted on profile', () => {
      expect(trace.saveBlocked).toBe(false);
      expect(trace.profileCreated).toBe(true);
      expect(trace.profileType).toBe('COMMISSION');
      expect(trace.profilePercentage).toBe(15);
      expect(trace.profileConfigured).toBe(true);
      expect(trace.hasPersistedTermsHydrated).toBe(true);
      expect(trace.earningsConfigured).toBe(true);
      expect(trace.settlementBasis).toBe('qualifying_catalog_purchases');
      expect(trace.failureStage).toBeNull();
    });
  });

  describe('D. Hybrid — "$300 management fee plus 5% of revenue."', () => {
    const party: ExtractedParty = {
      id: 'ep-hybrid',
      name: field('Manager'),
      email: field(''),
      role: field('Partner'),
      participationModel: field('revenue_share'),
      fixedAmount: field(300, 'high'),
      revenueSharePct: field(5, 'high'),
      notes: field(null),
    };
    const result = buildExtractionResult({ party });
    const trace = traceCompensationStructure({
      label: 'D_hybrid',
      conversationSnippet: '$300 management fee plus 5% of revenue.',
      result,
    });

    it('hybrid detected in review; mapper stores HYBRID with both legs', () => {
      expect(trace.isHybridDetected).toBe(true);
      expect(trace.saveBlocked).toBe(false);
      expect(trace.profileType).toBe('HYBRID');
      expect(trace.profilePercentage).toBe(5);
      expect(trace.profileFixedAmount).toBe(300);
      expect(trace.hasPersistedTermsHydrated).toBe(true);
      expect(trace.earningsConfigured).toBe(true);
      expect(trace.earningsPrimaryCompact).toContain('5%');
      expect(trace.earningsPrimaryCompact).toContain('300');
      expect(trace.settlementBasis).toBe('hybrid');
      expect(trace.failureStage).toBeNull();
    });
  });

  describe('D-fail. Hybrid incomplete — missing fixed component', () => {
    const party: ExtractedParty = {
      id: 'ep-hybrid-bad',
      name: field('Manager'),
      email: field(''),
      role: field('Partner'),
      participationModel: field('revenue_share'),
      fixedAmount: field(300, 'medium'),
      revenueSharePct: field(5, 'high'),
      notes: field(null),
    };
    const result = buildExtractionResult({ party });
    const reviewed = reviewFormFromExtraction(result, 'participant_add', 'whatsapp');
    const reviewedParty = { ...reviewed.parties[0]!, fixedAmount: null };

    it('save blocked when hybrid fixed amount cleared', () => {
      expect(isHybridCompensationParty(reviewedParty, party)).toBe(true);
      const issues = validateReviewFormCompensation([reviewedParty], new Map([[party.id, party]]));
      expect(issues[0]?.warnings[0]?.kind).toBe('hybrid_incomplete');
    });
  });

  describe('summary matrix (documented outcomes)', () => {
    it('exports expected matrix rows for reporting', () => {
      const rows: CompensationStructureTrace[] = [
        traceCompensationStructure({
          label: 'A',
          conversationSnippet: '$500 fixed AUD',
          result: buildExtractionResult({
            party: {
              id: 'a',
              name: field('Alex'),
              email: field(''),
              role: field('Contractor'),
              participationModel: field('fixed_payout'),
              fixedAmount: field(500),
              revenueSharePct: field(null, 'absent'),
              notes: field(null),
            },
          }),
        }),
        traceCompensationStructure({
          label: 'B',
          conversationSnippet: '10% ticket revenue',
          result: buildExtractionResult({
            party: {
              id: 'b',
              name: field('Sarah'),
              email: field(''),
              role: field('Referrer'),
              participationModel: field('revenue_share'),
              fixedAmount: field(null, 'absent'),
              revenueSharePct: field(10),
              notes: field(null),
            },
          }),
        }),
        traceCompensationStructure({
          label: 'C',
          conversationSnippet: '15% bookings referred',
          result: buildExtractionResult({
            party: {
              id: 'c',
              name: field('Promo'),
              email: field(''),
              role: field('Referrer'),
              participationModel: field('customer_attribution'),
              fixedAmount: field(null, 'absent'),
              revenueSharePct: field(15),
              notes: field(null),
            },
          }),
        }),
        traceCompensationStructure({
          label: 'D',
          conversationSnippet: '$300 + 5%',
          result: buildExtractionResult({
            party: {
              id: 'd',
              name: field('Mgr'),
              email: field(''),
              role: field('Partner'),
              participationModel: field('revenue_share'),
              fixedAmount: field(300),
              revenueSharePct: field(5),
              notes: field(null),
            },
          }),
        }),
      ];

      expect(rows[0]?.profileType).toBe('FIXED_FEE');
      expect(rows[0]?.failureStage).toBeNull();
      expect(rows[1]?.profileType).toBe('REVENUE_SHARE');
      expect(rows[1]?.failureStage).toBeNull();
      expect(rows[2]?.profileType).toBe('COMMISSION');
      expect(rows[2]?.earningsConfigured).toBe(true);
      expect(rows[3]?.profileType).toBe('HYBRID');
      expect(rows[3]?.isHybridDetected).toBe(true);
    });
  });
});
