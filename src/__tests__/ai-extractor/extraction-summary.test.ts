import { buildExtractionSummary } from '@/lib/ai-extractor/extraction-summary';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';

function field<T>(value: T, confidence: 'high' | 'medium' | 'low' | 'absent' = 'high') {
  return { value, confidence };
}

function party(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ep-1',
    name: field('Sarah'),
    email: field(null, 'absent'),
    role: field('Promoter'),
    participationModel: field('hybrid' as const),
    fixedAmount: field(300),
    revenueSharePct: field(10),
    deliverables: field([]),
    milestones: [],
    notes: field(null, 'absent'),
    ...overrides,
  };
}

function baseResult(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    projectName: field('Sunset Sessions'),
    projectDescription: field('Multi-party event agreement'),
    projectValue: field(8000),
    currency: field('AUD'),
    counterparty: field('James'),
    parties: [
      party({ id: 'ep-1', name: field('Sarah'), role: field('Promoter') }),
      party({
        id: 'ep-2',
        name: field('Mia'),
        role: field('Photography'),
        participationModel: field('hybrid'),
        fixedAmount: field(1000),
        revenueSharePct: field(5),
      }),
      party({
        id: 'ep-3',
        name: field('Ben'),
        role: field('Venue'),
        participationModel: field('hybrid'),
        fixedAmount: field(1200),
        revenueSharePct: field(15),
      }),
      party({
        id: 'ep-4',
        name: field('Alex'),
        role: field('Design'),
        participationModel: field('fixed_payout'),
        fixedAmount: field(600),
        revenueSharePct: field(null, 'absent'),
      }),
      party({
        id: 'ep-5',
        name: field('Chris'),
        role: field('Videography'),
        participationModel: field('fixed_payout'),
        fixedAmount: field(900),
        revenueSharePct: field(null, 'absent'),
      }),
    ],
    paymentTerms: [],
    uncertainties: [],
    overallConfidence: 'high',
    sourceHint: 'whatsapp',
    extractedAt: '2026-06-12T00:00:00.000Z',
    ...overrides,
  } as ExtractionResult;
}

describe('buildExtractionSummary', () => {
  it('does not use project budget as participant compensation in one-liner', () => {
    const summary = buildExtractionSummary(baseResult());
    expect(summary.oneLiner).not.toContain('AUD 8,000');
    expect(summary.oneLiner).not.toContain('$8,000');
    expect(summary.oneLiner).toContain('5 participants');
    expect(summary.oneLiner).toContain('Sunset Sessions');
  });

  it('counts non-exclusive fixed-fee, revenue-share, and hybrid obligations', () => {
    const summary = buildExtractionSummary(baseResult());
    expect(summary.participantCount).toBe(5);
    expect(summary.fixedFeeObligationCount).toBe(5);
    expect(summary.revenueShareObligationCount).toBe(3);
    expect(summary.hybridParticipantCount).toBe(3);
  });

  it('describes participant roles instead of budget amounts', () => {
    const summary = buildExtractionSummary(baseResult());
    expect(summary.oneLiner).toMatch(/including promoter, photography, venue/i);
  });
});
