/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { SettlementRiskCard } from '@/components/agreement-analyzer/settlement-risk-card';
import { buildSettlementRiskAssessment } from '@/lib/agreement-analyzer/extraction/build-settlement-risk-assessment';
import type { AgreementReportJson } from '@/lib/agreement-analyzer/extraction/extraction-types';

const baseReport: AgreementReportJson = {
  parties: [{}, {}, {}],
  revenueSplits: [{ beneficiary: 'Promoter', percentage: 70, basis: 'net revenue share' }],
  paymentConditions: [],
  obligations: [],
  risks: [{ description: 'Late settlement risk' }, { description: 'Dispute risk' }],
  missingInformation: [{ field: 'GST treatment' }],
  settlementReadiness: {
    score: 20,
    summary: 'Additional clarification is recommended before payout execution.',
    factors: [],
  },
};

describe('SettlementRiskCard', () => {
  it('renders risk score, level badge, issues, and guidance', () => {
    const assessment = buildSettlementRiskAssessment(
      { documentType: 'promoter-revenue-share' },
      baseReport
    );

    render(<SettlementRiskCard assessment={assessment} />);

    expect(screen.getByText('Settlement Risk Assessment')).toBeInTheDocument();
    expect(screen.getByText(assessment.riskLevel)).toBeInTheDocument();
    expect(screen.getByText(String(assessment.riskScore))).toBeInTheDocument();
    expect(screen.getByText('Potential Impact')).toBeInTheDocument();
    expect(screen.getByText(assessment.potentialImpact)).toBeInTheDocument();
    expect(screen.getByText('Recommendation')).toBeInTheDocument();
    expect(screen.getByText(assessment.recommendation)).toBeInTheDocument();
  });
});

describe('SettlementRiskCard absence handling', () => {
  it('is not rendered by parent when assessment is absent', () => {
    const { container } = render(<div data-testid="report-body" />);
    expect(container.querySelector('[data-testid="report-body"]')?.textContent).toBe('');
    expect(screen.queryByText('Settlement Risk Assessment')).not.toBeInTheDocument();
  });
});
