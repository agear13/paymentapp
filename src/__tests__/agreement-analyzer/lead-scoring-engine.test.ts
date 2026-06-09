import {
  calculateEngagementBonus,
  calculateSettlementComplexityScore,
  computeLeadScore,
  resolvePriorityBand,
} from '@/lib/agreement-analyzer/scoring/lead-scoring-engine';

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

describe('lead scoring engine', () => {
  it('scores revenue share event promoter agreements', () => {
    const result = computeLeadScore({
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
    });

    expect(result.signals.revenueShareDetected).toBe(true);
    expect(result.signals.eventDetected).toBe(true);
    expect(result.recommendedUseCase).toBe('Event Revenue Sharing');
    expect(result.settlementComplexityScore).toBe(30);
    expect(result.overallScore).toBe(50);
    expect(result.priorityBand).toBe('MEDIUM');
  });

  it('scores hospitality venue agreements', () => {
    const result = computeLeadScore({
      extractionJson: { documentType: 'venue-hire' },
      reportJson: baseReport({
        parties: [{}, {}],
        paymentConditions: [{ description: 'venue hire fee for restaurant and bar service' }],
        obligations: [{}, {}, {}],
        risks: [{}],
      }),
    });

    expect(result.signals.hospitalityDetected).toBe(true);
    expect(result.signals.revenueShareDetected).toBe(false);
    expect(result.recommendedUseCase).toBe('Obligation Management');
    expect(result.settlementComplexityScore).toBe(11);
    expect(result.overallScore).toBe(10);
    expect(result.priorityBand).toBe('LOW');
  });

  it('scores hospitality revenue share as venue settlement', () => {
    const result = computeLeadScore({
      extractionJson: { documentType: 'beach-club-profit-share' },
      reportJson: baseReport({
        parties: [{}, {}],
        revenueSplits: [{ party: 'Operator', percentage: 40, basis: 'profit share' }],
        paymentConditions: [{ description: 'nightclub bar settlement cycle' }],
        obligations: [{}, {}],
        risks: [{}],
      }),
    });

    expect(result.signals.revenueShareDetected).toBe(true);
    expect(result.signals.hospitalityDetected).toBe(true);
    expect(result.signals.eventDetected).toBe(false);
    expect(result.recommendedUseCase).toBe('Venue Settlement');
    expect(result.overallScore).toBe(50);
    expect(result.priorityBand).toBe('MEDIUM');
  });

  it('scores accountant coordination agreements', () => {
    const result = computeLeadScore({
      extractionJson: {
        documentType: 'trust-account-reconciliation',
        parties: [{}, {}],
      },
      reportJson: baseReport({
        parties: [{}, {}],
        paymentConditions: [{ description: 'trust account reconciliation and financial reporting' }],
        obligations: [{}, {}, {}],
        risks: [{}, {}],
        missingInformation: [{ field: 'monthly reconciliation schedule' }],
      }),
    });

    expect(result.signals.accountantDetected).toBe(true);
    expect(result.signals.revenueShareDetected).toBe(false);
    expect(result.recommendedUseCase).toBe('Client Fund Coordination');
    expect(result.settlementComplexityScore).toBe(13);
    expect(result.overallScore).toBe(10);
    expect(result.priorityBand).toBe('LOW');
  });

  it('scores multi-party agreements for multi party settlement', () => {
    const result = computeLeadScore({
      extractionJson: { documentType: 'partnership-agreement' },
      reportJson: baseReport({
        parties: [{}, {}, {}, {}],
        obligations: [{}, {}, {}, {}],
        risks: [{}, {}],
      }),
    });

    expect(result.signals.multiPartyDetected).toBe(true);
    expect(result.signals.partyCount).toBe(4);
    expect(result.recommendedUseCase).toBe('Multi Party Settlement');
    expect(result.settlementComplexityScore).toBe(12);
    expect(result.overallScore).toBe(15);
    expect(result.priorityBand).toBe('LOW');
  });

  it('applies engagement bonuses and caps overall score at 100', () => {
    const signals = {
      revenueShareDetected: true,
      hospitalityDetected: true,
      eventDetected: true,
      accountantDetected: true,
      multiPartyDetected: true,
      partyCount: 4,
      obligationCount: 10,
      riskCount: 8,
      revenueSplitCount: 4,
      paymentConditionCount: 4,
    };

    const complexity = calculateSettlementComplexityScore(signals);
    expect(complexity).toBe(68);

    const result = computeLeadScore({
      extractionJson: {
        documentType: 'complex event revenue share reconciliation',
        parties: [{ role: 'promoter' }, { role: 'venue' }, { role: 'artist' }],
      },
      reportJson: baseReport({
        parties: [{}, {}, {}, {}],
        revenueSplits: [{}, {}, {}, {}],
        paymentConditions: [{}, {}, {}, {}],
        obligations: Array.from({ length: 10 }, () => ({})),
        risks: Array.from({ length: 8 }, () => ({})),
      }),
      engagement: {
        reportViewed: true,
        emailOpened: true,
        emailClicked: true,
        demoClicked: true,
        demoBooked: true,
      },
    });

    expect(result.structuralFitScore).toBe(90);
    expect(result.engagementBonus).toBe(calculateEngagementBonus(result.engagement));
    expect(result.overallScore).toBe(100);
    expect(resolvePriorityBand(result.overallScore)).toBe('IDEAL_ICP');
  });

  it('adds engagement bonus on top of structural fit without changing structural score', () => {
    const structuralOnly = computeLeadScore({
      extractionJson: eventRevenueShareInput.extractionJson,
      reportJson: eventRevenueShareInput.reportJson,
    });
    const withEngagement = computeLeadScore({
      extractionJson: eventRevenueShareInput.extractionJson,
      reportJson: eventRevenueShareInput.reportJson,
      engagement: {
        reportViewed: true,
        emailOpened: true,
        emailClicked: false,
        demoClicked: false,
        demoBooked: false,
      },
    });

    expect(withEngagement.structuralFitScore).toBe(structuralOnly.structuralFitScore);
    expect(withEngagement.overallScore).toBe(
      structuralOnly.structuralFitScore + withEngagement.engagementBonus
    );
    expect(withEngagement.recommendedUseCase).toBe(structuralOnly.recommendedUseCase);
  });
});

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
