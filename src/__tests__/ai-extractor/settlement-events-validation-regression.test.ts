/**
 * Regression: schema v3 settlementEvents must not discard valid parties.
 *
 * Production logs showed Zod failures on settlementEvents[].partyId (string vs object)
 * and settlementEvents[].amount.confidence (missing), which previously caused
 * validateExtractionResult to throw and extractAgreementFromText to return degradedResult
 * with parties: [].
 */
import { validateExtractionResult } from '@/lib/ai-extractor/extraction-service';
import { buildExtractionSummary } from '@/lib/ai-extractor/extraction-summary';
import { mapSinglePartyToParticipant } from '@/lib/ai-extractor/extraction-mapper';
import { normalizeExtractionResult } from '@/lib/ai-extractor/normalize-extraction-result';
import { countPartyObligationMetrics } from '@/lib/ai-extractor/party-obligation-metrics';
import { reviewFormFromExtraction } from '@/lib/ai-extractor/review-form-types';
import type { RecentDeal } from '@/lib/data/mock-deal-network';

function field<T>(value: T, confidence: 'high' | 'medium' | 'low' | 'absent' = 'high') {
  return { value, confidence };
}

/** Exact shape from production: prompt v3 flat settlementEvents + missing confidence. */
function productionFailingPayloadV3(): Record<string, unknown> {
  return {
    schemaVersion: 'v3',
    projectName: field('NYE event at Ku De Ta'),
    projectDescription: field('Performance 10pm-2am Dec 31'),
    projectValue: field(15_000_000, 'medium'),
    currency: field(null, 'absent'),
    counterparty: field('Mike / Ku De Ta'),
    parties: [
      {
        id: 'ep-1',
        name: field('Alex'),
        email: field(null, 'absent'),
        role: field('DJ'),
        participationModel: field('fixed_payout'),
        fixedAmount: field(15_000_000, 'high'),
        revenueSharePct: field(null, 'absent'),
        milestones: [
          {
            description: field('Perform 10pm-2am Dec 31'),
            deadline: field('2025-12-31'),
            category: field('performance'),
            status: 'pending',
          },
        ],
        notes: field(null, 'absent'),
      },
      {
        id: 'ep-2',
        name: field('Sarah'),
        email: field(null, 'absent'),
        role: field('Referrer'),
        participationModel: field('revenue_share'),
        fixedAmount: field(null, 'absent'),
        revenueSharePct: field(10, 'high'),
        milestones: [
          {
            description: field('10% bar revenue share'),
            deadline: field(null, 'absent'),
            category: field('financial'),
            status: 'pending',
          },
        ],
        notes: field('10% bar revenue', 'medium'),
      },
    ],
    paymentTerms: [
      {
        description: field('50% deposit on signing'),
        amount: field(7_500_000, 'medium'),
        currency: field(null, 'absent'),
        dueCondition: field('On signing'),
      },
    ],
    settlementEvents: [
      {
        partyId: 'ep-1',
        partyName: 'Alex',
        type: 'fixed_fee',
        amount: { value: 15_000_000 },
        percentage: { value: null },
        trigger: { value: 'On completion' },
        condition: { value: null },
        status: 'pending',
      },
      {
        partyId: 'ep-2',
        partyName: 'Sarah',
        type: 'revenue_share',
        amount: { value: null },
        percentage: { value: 10 },
        trigger: { value: null },
        condition: { value: null },
        status: 'pending',
      },
    ],
    uncertainties: [],
    overallConfidence: 'medium',
    sourceHint: 'whatsapp',
    extractedAt: '2026-06-02T00:00:00.000Z',
  };
}

function baseDeal(): RecentDeal {
  return {
    id: 'deal-nye',
    dealName: 'NYE event at Ku De Ta',
    partner: 'Ku De Ta',
    value: 15_000_000,
    introducer: '',
    closer: '',
    status: 'Pending',
    lastUpdated: new Date().toISOString(),
    paymentStatus: 'Not Paid',
  };
}

describe('settlementEvents validation regression (schema v3)', () => {
  it('preserves parties when settlementEvents use flat strings and missing confidence', () => {
    const payload = productionFailingPayloadV3();

    const validated = validateExtractionResult(payload);
    expect(validated.parties).toHaveLength(2);
    expect(validated.uncertainties.some((u) => u.field === 'all')).toBe(false);

    const normalized = normalizeExtractionResult(validated);
    expect(normalized.parties).toHaveLength(2);

    const summary = buildExtractionSummary(normalized);
    expect(summary.participantCount).toBe(2);
    expect(summary.fixedFeeObligationCount).toBe(1);
    expect(summary.revenueShareObligationCount).toBe(1);
    expect(summary.oneLiner).not.toContain('No agreement details detected');

    const form = reviewFormFromExtraction(normalized, 'project_create', 'whatsapp', undefined, {
      workspaceCurrency: 'AUD',
    });
    expect(form.parties).toHaveLength(2);
    expect(form.projectName).toBe('NYE event at Ku De Ta');

    const obligations = countPartyObligationMetrics(normalized.parties);
    expect(obligations.fixedFeeObligationCount).toBe(1);
    expect(obligations.revenueShareObligationCount).toBe(1);

    const alex = mapSinglePartyToParticipant(form.parties[0]!, baseDeal(), '[AI Import]');
    const sarah = mapSinglePartyToParticipant(form.parties[1]!, baseDeal(), '[AI Import]');
    expect(alex.compensationProfile?.configured).toBe(true);
    expect(sarah.compensationProfile?.configured).toBe(true);
    expect(alex.compensationProfile?.compensationType).toBe('FIXED_FEE');
    expect(sarah.compensationProfile?.compensationType).toBe('REVENUE_SHARE');
  });

  it('accepts structured settlementEvents fields alongside flat legacy fields', () => {
    const payload = {
      ...productionFailingPayloadV3(),
      settlementEvents: [
        {
          partyId: { value: 'ep-1', confidence: 'high' },
          partyName: { value: 'Alex', confidence: 'high' },
          type: { value: 'fixed_fee', confidence: 'high' },
          amount: { value: 15_000_000, confidence: 'high' },
          percentage: { value: null, confidence: 'absent' },
          trigger: { value: 'On completion', confidence: 'medium' },
          condition: { value: null, confidence: 'absent' },
          status: 'pending',
        },
      ],
    };

    const validated = validateExtractionResult(payload);
    expect(validated.parties).toHaveLength(2);
    expect(validated.settlementEvents).toHaveLength(1);
    expect(validated.settlementEvents?.[0]?.partyId.value).toBe('ep-1');
  });

  it('drops only invalid settlementEvents while keeping valid parties and obligations', () => {
    const payload = {
      ...productionFailingPayloadV3(),
      settlementEvents: [
        {
          partyId: 'ep-1',
          partyName: 'Alex',
          type: 'not_a_valid_type',
          amount: { value: 100 },
          percentage: { value: null },
          trigger: { value: null },
          condition: { value: null },
          status: 'pending',
        },
      ],
    };

    const validated = validateExtractionResult(payload);
    expect(validated.parties).toHaveLength(2);
    expect(validated.settlementEvents ?? []).toHaveLength(0);
    expect(validated.uncertainties.some((u) => u.field === 'settlementEvents')).toBe(true);

    const normalized = normalizeExtractionResult(validated);
    expect(normalized.parties).toHaveLength(2);
    expect(normalized.settlementEvents?.length).toBeGreaterThan(0);
  });
});
