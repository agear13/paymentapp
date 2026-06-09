import { computeStructuralFitScore } from '@/lib/agreement-analyzer/scoring/compute-structural-fit-score';
import { computeLeadScore } from '@/lib/agreement-analyzer/scoring/lead-scoring-engine';

function baseReport(overrides: Record<string, unknown> = {}) {
  return {
    parties: [],
    revenueSplits: [],
    paymentConditions: [],
    obligations: [],
    risks: [],
    missingInformation: [],
    settlementReadiness: { score: 70, summary: 'Ready', factors: [] },
    ...overrides,
  };
}

const eventRevenueShareInput = {
  extractionJson: {
    documentType: 'promoter-revenue-share',
    parties: [{ name: 'Venue' }, { name: 'Promoter' }],
  },
  reportJson: baseReport({
    parties: [{}, {}],
    revenueSplits: [
      { beneficiary: 'Promoter', percentage: 70, basis: 'net revenue share' },
      { beneficiary: 'Venue', percentage: 30, basis: 'ticket revenue' },
    ],
    paymentConditions: [{}, {}],
    obligations: [{}, {}, {}, {}, {}],
    risks: [{}, {}],
  }),
};

describe('computeStructuralFitScore', () => {
  it('ignores engagement signals when calculating structural fit', () => {
    const structural = computeStructuralFitScore(eventRevenueShareInput);
    const withEngagement = computeLeadScore({
      ...eventRevenueShareInput,
      engagement: {
        reportViewed: true,
        emailOpened: true,
        emailClicked: true,
        demoClicked: true,
        demoBooked: true,
      },
    });

    expect(structural.structuralFitScore).toBe(50);
    expect(withEngagement.structuralFitScore).toBe(50);
    expect(withEngagement.overallScore).toBeGreaterThan(structural.structuralFitScore);
    expect(withEngagement.engagementBonus).toBeGreaterThan(0);
  });

  it('returns a stable structural score regardless of engagement', () => {
    const first = computeStructuralFitScore(eventRevenueShareInput);
    const second = computeStructuralFitScore(eventRevenueShareInput);

    expect(first).toEqual(second);
  });

  it('derives priority band from structural fit only', () => {
    const result = computeStructuralFitScore(eventRevenueShareInput);

    expect(result.priorityBand).toBe('MEDIUM');
    expect(result.structuralFitScore).toBe(50);
  });

  it('derives recommended use case from agreement structure', () => {
    const result = computeStructuralFitScore(eventRevenueShareInput);

    expect(result.recommendedUseCase).toBe('Event Revenue Sharing');
    expect(result.signals.revenueShareDetected).toBe(true);
    expect(result.signals.eventDetected).toBe(true);
  });
});
