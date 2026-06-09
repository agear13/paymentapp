import { buildProvvypayFit } from '@/lib/agreement-analyzer/extraction/build-provvypay-fit';
import type { AgreementReportJson } from '@/lib/agreement-analyzer/extraction/extraction-types';
import { parsePublicReportJson } from '@/lib/agreement-analyzer/report-types';

function createReport(overrides: Partial<AgreementReportJson> = {}): AgreementReportJson {
  return {
    parties: [],
    revenueSplits: [],
    paymentConditions: [],
    obligations: [],
    risks: [],
    missingInformation: [],
    settlementReadiness: {
      score: 72,
      summary: 'Review recommended before payout execution.',
      factors: [],
    },
    ...overrides,
  };
}

describe('buildProvvypayFit', () => {
  it('scores event revenue sharing agreements using lead scoring signals', () => {
    const report = createReport({
      parties: [{}, {}],
      revenueSplits: [
        { beneficiary: 'Promoter', percentage: 70, basis: 'net revenue share' },
        { beneficiary: 'Venue', percentage: 30, basis: 'ticket revenue' },
      ],
      paymentConditions: [{}, {}],
      obligations: [{}, {}, {}, {}, {}],
      risks: [{}, {}],
    });

    const fit = buildProvvypayFit(
      {
        documentType: 'promoter-revenue-share',
        parties: [{ name: 'Venue' }, { name: 'Promoter' }],
      },
      report
    );

    expect(fit.fitScore).toBe(50);
    expect(fit.priorityBand).toBe('MEDIUM');
    expect(fit.recommendedUseCase).toBe('Event Revenue Sharing');
    expect(fit.signals.revenueShareDetected).toBe(true);
    expect(fit.signals.eventDetected).toBe(true);
    expect(fit.headline).toBe('Strong fit for event revenue sharing');
    expect(fit.strengths).toEqual(
      expect.arrayContaining([
        'Revenue-sharing terms were identified in this agreement.',
        'Event promotion or ticketing patterns were detected.',
      ])
    );
  });

  it('reuses venue settlement recommended use case for hospitality revenue share', () => {
    const fit = buildProvvypayFit(
      { documentType: 'beach-club-profit-share' },
      createReport({
        parties: [{}, {}],
        revenueSplits: [{ party: 'Operator', percentage: 40, basis: 'profit share' }],
        paymentConditions: [{ description: 'nightclub bar settlement cycle' }],
        obligations: [{}, {}],
        risks: [{}],
      })
    );

    expect(fit.recommendedUseCase).toBe('Venue Settlement');
    expect(fit.fitLabel).toBe('Moderate Provvypay fit');
  });

  it('flags multi-party settlement opportunities deterministically', () => {
    const fit = buildProvvypayFit(
      { documentType: 'partnership-agreement' },
      createReport({
        parties: [{}, {}, {}, {}],
        obligations: [{}, {}, {}, {}],
        risks: [{}, {}],
      })
    );

    expect(fit.recommendedUseCase).toBe('Multi Party Settlement');
    expect(fit.signals.multiPartyDetected).toBe(true);
    expect(fit.considerations).toEqual(
      expect.arrayContaining([
        'Multi-party structures often rely on spreadsheets and manual transfers without automation.',
      ])
    );
  });

  it('adds settlement readiness considerations for lower readiness scores', () => {
    const fit = buildProvvypayFit(
      { documentType: 'service-agreement' },
      createReport({
        settlementReadiness: {
          score: 55,
          summary: 'Additional clarification is recommended before payout execution.',
          factors: ['Payment conditions are unclear.'],
        },
      })
    );

    expect(fit.considerations).toEqual(
      expect.arrayContaining([
        'Settlement readiness gaps may need clarification before automated payout execution.',
        'No revenue-sharing split rules were identified for automated allocation.',
      ])
    );
  });
});

describe('parsePublicReportJson provvypay fit compatibility', () => {
  it('parses legacy report_json without provvypayFit', () => {
    const parsed = parsePublicReportJson(createReport());
    expect(parsed?.provvypayFit).toBeUndefined();
  });

  it('parses report_json with provvypayFit attached', () => {
    const fit = buildProvvypayFit(
      { documentType: 'promoter-revenue-share' },
      createReport({
        parties: [{}, {}],
        revenueSplits: [{ beneficiary: 'Promoter', percentage: 70, basis: 'net revenue share' }],
        paymentConditions: [{}],
        obligations: [{}, {}],
      })
    );

    const parsed = parsePublicReportJson({
      ...createReport(),
      provvypayFit: fit,
    });

    expect(parsed?.provvypayFit).toEqual(fit);
  });
});
