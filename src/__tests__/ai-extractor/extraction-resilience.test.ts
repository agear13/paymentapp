/**
 * Resilience: malformed optional enrichment must not destroy core extraction data.
 */
import { validateExtractionResult } from '@/lib/ai-extractor/extraction-service';
import { buildExtractionSummary } from '@/lib/ai-extractor/extraction-summary';
import { normalizeExtractionResult } from '@/lib/ai-extractor/normalize-extraction-result';
import { countPartyObligationMetrics } from '@/lib/ai-extractor/party-obligation-metrics';
import { reviewFormFromExtraction } from '@/lib/ai-extractor/review-form-types';

function field<T>(value: T, confidence: 'high' | 'medium' | 'low' | 'absent' = 'high') {
  return { value, confidence };
}

function resilientPayload(): Record<string, unknown> {
  return {
    schemaVersion: 'v3',
    projectName: field('Summer Beach Event'),
    projectDescription: field('DJ set and bar revenue share'),
    projectValue: field(2500),
    currency: field('AUD'),
    counterparty: field('Venue Co'),
    parties: [
      {
        id: 'ep-1',
        name: field('Island DJs'),
        email: field(null, 'absent'),
        role: field('DJ'),
        participationModel: field('fixed_payout'),
        fixedAmount: field(2500, 'high'),
        revenueSharePct: field(null, 'absent'),
        milestones: [
          {
            description: field('Perform 6pm-midnight'),
            deadline: field('2026-07-04'),
            category: field('performance'),
            status: 'pending',
          },
        ],
        conditions: [
          {
            description: { value: 'Must bring own decks' },
            dependsOn: null,
            status: 'pending',
          },
        ],
        notes: field(null, 'absent'),
      },
    ],
    paymentTerms: [
      {
        description: { value: '50% deposit' },
        amount: field(1250),
        currency: field('AUD'),
        dueCondition: field('On signing'),
      },
    ],
    settlementEvents: [
      {
        partyId: 'ep-1',
        partyName: 'Island DJs',
        type: 'fixed_fee',
        amount: { value: 2500 },
        percentage: { value: null },
        trigger: { value: 'On completion' },
        condition: { value: null },
        status: 'pending',
      },
    ],
    uncertainties: [],
    overallConfidence: 'high',
    sourceHint: 'whatsapp',
    extractedAt: '2026-06-15T12:00:00.000Z',
  };
}

describe('extraction resilience (optional field failures)', () => {
  it('preserves participant and obligations when conditions, paymentTerms, and settlementEvents are malformed', () => {
    const validated = validateExtractionResult(resilientPayload());
    expect(validated.uncertainties.some((u) => u.field === 'all')).toBe(false);
    expect(validated.parties).toHaveLength(1);
    expect(validated.paymentTerms).toHaveLength(1);

    const normalized = normalizeExtractionResult(validated);
    const summary = buildExtractionSummary(normalized);
    expect(summary.participantCount).toBeGreaterThan(0);

    const obligations = countPartyObligationMetrics(normalized.parties);
    expect(obligations.fixedFeeObligationCount).toBeGreaterThan(0);

    const form = reviewFormFromExtraction(normalized, 'project_create', 'whatsapp');
    expect(form.parties).toHaveLength(1);
    expect(form.parties[0]?.fixedAmount).toBe(2500);
  });

  it('drops invalid payment terms individually without rejecting the participant', () => {
    const payload = {
      ...resilientPayload(),
      paymentTerms: [
        {
          description: { value: 'Valid deposit' },
          amount: field(1250),
          currency: field('AUD'),
          dueCondition: field('On signing'),
        },
        {
          description: 'flat string description',
          amount: 'not-a-number',
          currency: null,
          dueCondition: null,
        },
      ],
    };

    const validated = validateExtractionResult(payload);
    expect(validated.parties).toHaveLength(1);
    expect(validated.paymentTerms).toHaveLength(1);
    expect(validated.uncertainties.some((u) => u.field === 'paymentTerms')).toBe(true);
  });

  it('drops invalid conditions while keeping the participant and milestones', () => {
    const payload = {
      ...resilientPayload(),
      parties: [
        {
          ...(resilientPayload().parties as object[])[0],
          conditions: [
            { description: 'missing value wrapper', dependsOn: null },
            {
              description: field('Valid condition'),
              dependsOn: field(null, 'absent'),
            },
          ],
        },
      ],
    };

    const validated = validateExtractionResult(payload);
    expect(validated.parties).toHaveLength(1);
    expect(validated.parties[0]?.conditions).toHaveLength(1);
    expect(validated.parties[0]?.milestones).toHaveLength(1);
  });
});
