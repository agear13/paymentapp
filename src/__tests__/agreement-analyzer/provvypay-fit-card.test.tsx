/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { ProvvypayFitCard } from '@/components/agreement-analyzer/provvypay-fit-card';
import { buildProvvypayFit } from '@/lib/agreement-analyzer/extraction/build-provvypay-fit';
import type { AgreementReportJson } from '@/lib/agreement-analyzer/extraction/extraction-types';

const baseReport: AgreementReportJson = {
  parties: [{}, {}],
  revenueSplits: [
    { beneficiary: 'Promoter', percentage: 70, basis: 'net revenue share' },
    { beneficiary: 'Venue', percentage: 30, basis: 'ticket revenue' },
  ],
  paymentConditions: [{}, {}],
  obligations: [{}, {}, {}, {}, {}],
  risks: [{}, {}],
  missingInformation: [],
  settlementReadiness: {
    score: 72,
    summary: 'Review recommended before payout execution.',
    factors: [],
  },
};

describe('ProvvypayFitCard', () => {
  it('renders fit score, recommended use case, and strengths', () => {
    const fit = buildProvvypayFit(
      {
        documentType: 'promoter-revenue-share',
        parties: [{ name: 'Venue' }, { name: 'Promoter' }],
      },
      baseReport
    );

    render(<ProvvypayFitCard fit={fit} />);

    expect(screen.getByText('Provvypay Fit')).toBeInTheDocument();
    expect(screen.getByText('Strong fit for event revenue sharing')).toBeInTheDocument();
    expect(screen.getAllByText('Event Revenue Sharing').length).toBeGreaterThan(0);
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('Why this fits')).toBeInTheDocument();
    expect(
      screen.getByText('Revenue-sharing terms were identified in this agreement.')
    ).toBeInTheDocument();
    expect(screen.getByText('Recommended Provvypay workflow')).toBeInTheDocument();
  });
});

describe('ProvvypayFitCard absence handling', () => {
  it('is not rendered by parent when provvypayFit is absent', () => {
    const { container } = render(<div data-testid="report-body" />);
    expect(container.querySelector('[data-testid="report-body"]')?.textContent).toBe('');
    expect(screen.queryByText('Provvypay Fit')).not.toBeInTheDocument();
  });
});
