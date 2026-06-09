import { buildSettlementRiskAssessment } from '@/lib/agreement-analyzer/extraction/build-settlement-risk-assessment';
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
      score: 80,
      summary: 'Review recommended before payout execution.',
      factors: [],
    },
    ...overrides,
  };
}

describe('buildSettlementRiskAssessment', () => {
  it('returns low risk for clean agreements', () => {
    const assessment = buildSettlementRiskAssessment(
      { documentType: 'service-agreement' },
      createReport()
    );

    expect(assessment.riskLevel).toBe('LOW');
    expect(assessment.riskScore).toBeLessThanOrEqual(30);
    expect(assessment.potentialImpact).toBe('Minor operational ambiguities detected.');
    expect(assessment.recommendation).toBe('Continue monitoring settlement processes.');
  });

  it('returns medium risk when risks and missing information accumulate', () => {
    const assessment = buildSettlementRiskAssessment(
      { documentType: 'promoter-revenue-share' },
      createReport({
        risks: [{ description: 'Late settlement risk' }, { description: 'Dispute risk' }],
        missingInformation: [{ field: 'GST treatment' }],
        settlementReadiness: {
          score: 60,
          summary: 'Review recommended before payout execution.',
          factors: [],
        },
      })
    );

    expect(assessment.riskLevel).toBe('MEDIUM');
    expect(assessment.issueCount).toBeGreaterThan(0);
    expect(assessment.potentialImpact).toBe(
      'These issues may create settlement delays or manual reconciliation work.'
    );
  });

  it('returns high risk with readiness amplification below 25', () => {
    const assessment = buildSettlementRiskAssessment(
      { documentType: 'promoter-revenue-share' },
      createReport({
        parties: [{}, {}, {}],
        risks: [
          { description: 'Late settlement risk' },
          { description: 'Dispute risk' },
          { description: 'Chargeback exposure' },
        ],
        missingInformation: [
          { field: 'GST treatment' },
          { field: 'Final settlement timing' },
        ],
        settlementReadiness: {
          score: 20,
          summary: 'Additional clarification is recommended before payout execution.',
          factors: [],
        },
      })
    );

    expect(assessment.riskLevel).toBe('HIGH');
    expect(assessment.riskScore).toBeGreaterThan(60);
    expect(assessment.recommendation).toBe(
      'Consider formalising settlement rules and automating settlement workflows.'
    );
  });

  it('amplifies risk for revenue share and multi-party agreements', () => {
    const withoutAmplifiers = buildSettlementRiskAssessment(
      { documentType: 'service-agreement' },
      createReport({
        risks: [{ description: 'Operational risk' }],
      })
    );
    const withAmplifiers = buildSettlementRiskAssessment(
      { documentType: 'promoter-revenue-share' },
      createReport({
        parties: [{}, {}, {}],
        revenueSplits: [{ beneficiary: 'Promoter', percentage: 70, basis: 'net revenue share' }],
        risks: [{ description: 'Operational risk' }],
      })
    );

    expect(withAmplifiers.riskScore).toBeGreaterThan(withoutAmplifiers.riskScore);
  });

  it('caps risk score at 100', () => {
    const assessment = buildSettlementRiskAssessment(
      { documentType: 'promoter-revenue-share' },
      createReport({
        parties: [{}, {}, {}, {}],
        risks: Array.from({ length: 8 }, (_, index) => ({ description: `Risk ${index + 1}` })),
        missingInformation: Array.from({ length: 6 }, (_, index) => ({ field: `Gap ${index + 1}` })),
        settlementReadiness: {
          score: 10,
          summary: 'Additional clarification is recommended before payout execution.',
          factors: [],
        },
      })
    );

    expect(assessment.riskScore).toBe(100);
    expect(assessment.riskLevel).toBe('HIGH');
  });

  it('collects up to five unique issues from risks and missing information', () => {
    const assessment = buildSettlementRiskAssessment(
      { documentType: 'promoter-revenue-share' },
      createReport({
        risks: [
          { description: 'Late settlement risk' },
          { description: 'Dispute risk' },
          { description: 'Late settlement risk' },
        ],
        missingInformation: [
          { field: 'GST treatment' },
          { field: 'Final settlement timing' },
          { field: 'Dispute resolution clause' },
          { field: 'Audit rights' },
        ],
      })
    );

    expect(assessment.issues).toHaveLength(5);
    expect(new Set(assessment.issues).size).toBe(assessment.issues.length);
  });
});

describe('parsePublicReportJson settlement risk compatibility', () => {
  it('parses legacy report_json without settlementRiskAssessment', () => {
    const parsed = parsePublicReportJson(createReport());
    expect(parsed?.settlementRiskAssessment).toBeUndefined();
  });

  it('parses report_json with settlementRiskAssessment attached', () => {
    const assessment = buildSettlementRiskAssessment(
      { documentType: 'promoter-revenue-share' },
      createReport({
        risks: [{ description: 'Late settlement risk' }],
      })
    );

    const parsed = parsePublicReportJson({
      ...createReport(),
      settlementRiskAssessment: assessment,
    });

    expect(parsed?.settlementRiskAssessment).toEqual(assessment);
  });
});
