/**
 * Regression tests for extraction validation with absent/null currency.
 */
import { ZodError } from 'zod';
import { validateExtractionResult } from '@/lib/ai-extractor/extraction-service';
import { buildExtractionSummary } from '@/lib/ai-extractor/extraction-summary';
import { reviewFormFromExtraction } from '@/lib/ai-extractor/review-form-types';
import { mapSinglePartyToParticipant } from '@/lib/ai-extractor/extraction-mapper';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';

function field<T>(value: T, confidence: 'high' | 'medium' | 'low' | 'absent' = 'high') {
  return { value, confidence };
}

/** Model-shaped payload for bundled example conversation (IDR fees, no ISO currency). */
function realisticExtractedPayload(): Record<string, unknown> {
  return {
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
        role: field('Contractor'),
        participationModel: field('fixed_payout'),
        fixedAmount: field(15_000_000, 'high'),
        revenueSharePct: field(null, 'absent'),
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
        notes: field('10% bar revenue', 'medium'),
      },
    ],
    paymentTerms: [],
    uncertainties: [],
    overallConfidence: 'medium',
    sourceHint: 'whatsapp',
    extractedAt: '2026-06-02T00:00:00.000Z',
  };
}

function attemptValidation(raw: unknown): { passes: boolean; issues: ZodError['issues'] } {
  try {
    validateExtractionResult(raw);
    return { passes: true, issues: [] };
  } catch (err) {
    if (err instanceof ZodError) return { passes: false, issues: err.issues };
    throw err;
  }
}

describe('extraction failure simulation', () => {
  it('documents degradedResult UI strings for Failure B', () => {
    const degraded: ExtractionResult = {
      projectName: field(null, 'absent'),
      projectDescription: field(null, 'absent'),
      projectValue: field(null, 'absent'),
      currency: field(null, 'absent'),
      counterparty: field(null, 'absent'),
      parties: [],
      paymentTerms: [],
      uncertainties: [
        {
          field: 'all',
          issue:
            'AI response did not match expected format. Please fill in all fields manually.',
        },
      ],
      overallConfidence: 'low',
      sourceHint: null,
      extractedAt: '2026-06-02T00:00:00.000Z',
    };

    const summary = buildExtractionSummary(degraded);
    expect(summary.participantCount).toBe(0);
    expect(summary.oneLiner).toBe(
      'No agreement details detected. Please fill in all fields manually.'
    );
    expect(degraded.uncertainties[0]?.issue).toContain('did not match expected format');
  });

  it('realistic IDR-shaped payload passes production validation with null currency', () => {
    const payload = realisticExtractedPayload();
    const result = attemptValidation(payload);

    expect(result.passes).toBe(true);
    expect(result.issues).toHaveLength(0);

    const parsed = validateExtractionResult(payload);
    expect(parsed.parties).toHaveLength(2);
    expect(parsed.currency.value).toBeNull();
    expect(parsed.currency.confidence).toBe('absent');

    const form = reviewFormFromExtraction(parsed, 'project_create', 'whatsapp', undefined, {
      workspaceCurrency: 'AUD',
    });
    expect(form.parties).toHaveLength(2);
    expect(form.currency).toBe('AUD');
    expect(form.parties[1]?.revenueSharePct).toBe(10);

    const deal: RecentDeal = {
      id: 'deal-sim',
      dealName: 'Sim',
      partner: 'P',
      value: 0,
      introducer: '',
      closer: '',
      status: 'Pending',
      lastUpdated: new Date().toISOString(),
      paymentStatus: 'Not Paid',
    };
    const mapped = mapSinglePartyToParticipant(form.parties[1]!, deal, '[AI Import]');
    expect(mapped.compensationProfile?.configured).toBe(true);
  });

  it('payment term with null currency passes production validation', () => {
    const payload = {
      ...realisticExtractedPayload(),
      paymentTerms: [
        {
          description: field('Deposit'),
          amount: field(1000),
          currency: field(null, 'absent'),
          dueCondition: field(null),
        },
      ],
    };
    const result = attemptValidation(payload);
    expect(result.passes).toBe(true);

    const parsed = validateExtractionResult(payload);
    expect(parsed.paymentTerms[0]?.currency.value).toBeNull();
  });
});
