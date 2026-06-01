import type { ExtractedParty } from '@/lib/ai-extractor/extraction-types';
import type { ReviewedParty } from '@/lib/ai-extractor/review-form-types';
import {
  describeExtractedCompensationGap,
  getPartyCompensationWarnings,
  isHybridCompensationParty,
  isRevenueSharePctComplete,
  isFixedPayoutAmountComplete,
  reviewedPartyFromExtracted,
  validateReviewFormCompensation,
  wasExtractedCompensationIncomplete,
} from '@/lib/ai-extractor/compensation-review-validation';
import { mapSinglePartyToParticipant } from '@/lib/ai-extractor/extraction-mapper';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { isParticipantEarningsConfigured } from '@/lib/operations/selectors/participant-earnings-selectors';
import { deriveCompensationState } from '@/lib/operations/derivations/derive-compensation-state';
import { hydrateOperationalParticipant } from '@/lib/operations/hydration/hydrate-operational-participant';
import {
  buildIncompleteExtractionCompensationAuditEntries,
} from '@/lib/operations/audit/conversation-import-audit';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';

function field<T>(value: T, confidence: 'high' | 'medium' | 'low' | 'absent' = 'high') {
  return { value, confidence };
}

function baseDeal(): RecentDeal {
  return {
    id: 'deal-1',
    dealName: 'Event',
    partner: 'Venue',
    value: 50000,
    introducer: '',
    closer: '',
    status: 'Pending',
    lastUpdated: new Date().toISOString(),
    paymentStatus: 'Not Paid',
  };
}

function party(overrides: Partial<ReviewedParty> = {}): ReviewedParty {
  return {
    id: 'ep-1',
    name: 'Alex',
    email: '',
    role: 'Partner',
    participationModel: 'revenue_share',
    fixedAmount: null,
    revenueSharePct: null,
    notes: '',
    ...overrides,
  };
}

function extractedParty(overrides: Partial<ExtractedParty> = {}): ExtractedParty {
  return {
    id: 'ep-1',
    name: field('Alex'),
    email: field(''),
    role: field('Partner'),
    participationModel: field('revenue_share'),
    fixedAmount: field(null),
    revenueSharePct: field(null),
    notes: field(null),
    ...overrides,
  };
}

describe('compensation review validation — acceptance scenarios', () => {
  it('Test 1: Alex 10% revenue share — save allowed, earnings configured', () => {
    const reviewed = party({ revenueSharePct: 10 });
    expect(getPartyCompensationWarnings(reviewed)).toEqual([]);
    expect(validateReviewFormCompensation([reviewed])).toEqual([]);

    const mapped = mapSinglePartyToParticipant(reviewed, baseDeal(), '[AI Import]');
    const hydrated = hydrateOperationalParticipant(mapped);
    expect(isParticipantEarningsConfigured(hydrated)).toBe(true);
    expect(deriveCompensationState(hydrated).earningsPrimaryCompact).toBe('10% revenue share');
  });

  it('Test 2: Alex share of ticket sales — warning shown, save blocked', () => {
    const reviewed = party({ revenueSharePct: null });
    const original = extractedParty({ revenueSharePct: field(null, 'absent') });
    const warnings = getPartyCompensationWarnings(reviewed, original);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.kind).toBe('revenue_share_missing_pct');
    expect(warnings[0]?.title).toBe('Revenue share detected');

    const issues = validateReviewFormCompensation([reviewed], new Map([[reviewed.id, original]]));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.blockSaveMessage).toContain('Enter a percentage');
  });

  it('Test 3: Alex $5,000 fixed payout — save allowed', () => {
    const reviewed = party({
      participationModel: 'fixed_payout',
      fixedAmount: 5000,
      revenueSharePct: null,
    });
    expect(getPartyCompensationWarnings(reviewed)).toEqual([]);
    expect(validateReviewFormCompensation([reviewed])).toEqual([]);

    const mapped = mapSinglePartyToParticipant(reviewed, baseDeal(), '[AI Import]');
    expect(mapped.compensationProfile?.compensationType).toBe('FIXED_FEE');
    expect(isParticipantEarningsConfigured(hydrateOperationalParticipant(mapped))).toBe(true);
  });

  it('Test 4: DJs — compensation review warning, save blocked', () => {
    const reviewed = party({
      id: 'ep-djs',
      name: 'DJs',
      role: 'Contractor',
      revenueSharePct: null,
    });
    const original = extractedParty({
      id: 'ep-djs',
      name: field('DJs'),
      role: field('Contractor'),
      participationModel: field('revenue_share', 'medium'),
      revenueSharePct: field(null, 'absent'),
    });
    expect(getPartyCompensationWarnings(reviewed, original)[0]?.kind).toBe(
      'revenue_share_missing_pct'
    );
    expect(validateReviewFormCompensation([reviewed], new Map([[reviewed.id, original]]))).toHaveLength(
      1
    );
  });

  it('Test 5: hybrid 5% + $2,000 — save allowed, earnings configured', () => {
    const reviewed = party({
      name: 'Promotions',
      revenueSharePct: 5,
      fixedAmount: 2000,
    });
    const original = extractedParty({
      name: field('Promotions'),
      participationModel: field('revenue_share'),
      revenueSharePct: field(5),
      fixedAmount: field(2000),
    });
    expect(isHybridCompensationParty(reviewed, original)).toBe(true);
    expect(getPartyCompensationWarnings(reviewed, original)).toEqual([]);
    expect(isRevenueSharePctComplete(reviewed)).toBe(true);
    expect(isFixedPayoutAmountComplete(reviewed)).toBe(true);

    const mapped = mapSinglePartyToParticipant(reviewed, baseDeal(), '[AI Import]');
    expect(isParticipantEarningsConfigured(hydrateOperationalParticipant(mapped))).toBe(true);
  });

  it('blocks zero or negative revenue share percentages', () => {
    expect(getPartyCompensationWarnings(party({ revenueSharePct: 0 }))).toHaveLength(1);
    expect(getPartyCompensationWarnings(party({ revenueSharePct: -1 }))).toHaveLength(1);
  });

  it('shows hybrid warning when one component is missing', () => {
    const reviewed = party({ revenueSharePct: 5, fixedAmount: null });
    const original = extractedParty({
      revenueSharePct: field(5),
      fixedAmount: field(2000),
    });
    expect(isHybridCompensationParty(reviewed, original)).toBe(true);
    const warnings = getPartyCompensationWarnings(reviewed, original);
    expect(warnings[0]?.kind).toBe('hybrid_incomplete');
  });

  it('creates informational audit entries for extraction gaps', () => {
    const original = extractedParty({
      id: 'ep-djs',
      name: field('DJs'),
      participationModel: field('revenue_share'),
      revenueSharePct: field(null, 'absent'),
    });
    expect(wasExtractedCompensationIncomplete(original)).toBe(true);
    expect(describeExtractedCompensationGap(original)).toContain('DJs');

    const result: ExtractionResult = {
      projectName: field('Event'),
      projectDescription: field(null),
      projectValue: field(50000),
      currency: field('AUD'),
      counterparty: field(null),
      parties: [original],
      paymentTerms: [],
      uncertainties: [],
      overallConfidence: 'medium',
      sourceHint: null,
      extractedAt: new Date().toISOString(),
    };

    const entries = buildIncompleteExtractionCompensationAuditEntries({
      projectId: 'deal-1',
      result,
      importedAt: '2026-05-20T12:00:00.000Z',
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.type).toBe('compensation_extraction_incomplete');
    expect(entries[0]?.title).toBe('Compensation terms require review');
    expect(entries[0]?.description).toContain('DJs');
  });

  it('shows Needs review in participant table when model set but terms missing', () => {
    const mapped = mapSinglePartyToParticipant(
      party({ name: 'DJs', revenueSharePct: null }),
      baseDeal(),
      '[AI Import]'
    );
    const hydrated = hydrateOperationalParticipant(mapped);
    const state = deriveCompensationState(hydrated);
    expect(state.earningsPrimaryCompact).toBe('Needs review');
    expect(state.earningsSecondary).toBe('Compensation amount missing');
    expect(state.settlementBasis).toBe('not_configured');
  });
});

describe('reviewedPartyFromExtracted', () => {
  it('maps extraction fields to reviewed party shape', () => {
    const original = extractedParty({ revenueSharePct: field(10) });
    expect(reviewedPartyFromExtracted(original).revenueSharePct).toBe(10);
  });
});
