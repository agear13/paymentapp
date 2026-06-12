import { buildExtractionSummary, derivePartyConfidence } from '@/lib/ai-extractor/extraction-summary';
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
    deliverables: field(['Influencer outreach', 'Social media promotion']),
    milestones: [],
    serviceCategories: field(['Marketing']),
    conditions: [],
    dependencies: [],
    notes: field(null, 'absent'),
    ...overrides,
  };
}

function baseResult(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    projectName: field('Sunset Sessions'),
    projectDescription: field('Multi-party event agreement'),
    projectValue: field(8000),
    currency: field(null, 'absent'),
    counterparty: field('James'),
    parties: [
      party({ id: 'ep-1', name: field('Sarah'), role: field('Promoter') }),
      party({
        id: 'ep-2',
        name: field('Mia'),
        role: field('Photographer'),
        participationModel: field('fixed_payout'),
        fixedAmount: field(1000),
        revenueSharePct: field(null, 'absent'),
        deliverables: field(['Event photography', 'Artist photos', '50 edited images']),
        serviceCategories: field(['Photography']),
      }),
      party({
        id: 'ep-3',
        name: field('Ben'),
        role: field('Venue'),
        participationModel: field('hybrid'),
        fixedAmount: field(1200),
        revenueSharePct: field(15),
        serviceCategories: field(['Venue']),
      }),
      party({
        id: 'ep-4',
        name: field('Alex'),
        role: field('Contractor'),
        participationModel: field('fixed_payout'),
        fixedAmount: field(600, 'high'),
        revenueSharePct: field(null, 'absent'),
        deliverables: field(['Event photography', 'Artist photos', 'Crowd shots', '50 edited images']),
        milestones: [
          {
            description: field('$150 bonus if attendance exceeds 500', 'medium'),
            deadline: field(null, 'absent'),
            category: field('financial'),
            status: 'conditional' as const,
          },
        ],
        serviceCategories: field(['Photography']),
      }),
      party({
        id: 'ep-5',
        name: field('Chris'),
        role: field('Contractor'),
        participationModel: field('fixed_payout'),
        fixedAmount: field(900),
        revenueSharePct: field(null, 'absent'),
        deliverables: field(['Event recap video', 'Instagram reels']),
        serviceCategories: field(['Videography']),
      }),
    ],
    paymentTerms: [],
    uncertainties: [{ field: 'currency', issue: 'Currency not specified' }],
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

  it('uses service categories instead of generic contractor labels', () => {
    const summary = buildExtractionSummary(baseResult());
    expect(summary.oneLiner).not.toMatch(/including contractor/i);
    expect(summary.serviceCategories).toEqual(
      expect.arrayContaining(['Marketing', 'Photography', 'Venue', 'Videography'])
    );
    expect(summary.oneLiner).toMatch(/marketing|photography|videography|venue/i);
  });

  it('counts non-exclusive fixed-fee, revenue-share, and hybrid obligations', () => {
    const summary = buildExtractionSummary(baseResult());
    expect(summary.participantCount).toBe(5);
    expect(summary.fixedFeeObligationCount).toBe(5);
    expect(summary.revenueShareObligationCount).toBe(2);
    expect(summary.hybridParticipantCount).toBe(2);
  });

  it('keeps Alex at high confidence despite conditional bonus milestone', () => {
    const alex = baseResult().parties[3]!;
    expect(derivePartyConfidence(alex)).toBe('high');
  });
});
