/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { ExecutiveSummaryCard } from '@/components/agreement-analyzer/executive-summary-card';

const sampleSummary = {
  headline: 'Revenue Sharing Agreement',
  summary:
    'This agreement appears to be a revenue-sharing arrangement between Harbour Events and Pulse Promotions.',
  keyFindings: [
    'No dispute resolution clause identified',
    'GST treatment is not defined',
  ],
  operationalImpact:
    'These gaps may create payment disputes or settlement delays if managed manually.',
};

describe('ExecutiveSummaryCard', () => {
  it('renders headline, summary, findings, and operational impact', () => {
    render(<ExecutiveSummaryCard summary={sampleSummary} />);

    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Revenue Sharing Agreement');
    expect(screen.getByText(sampleSummary.summary)).toBeInTheDocument();
    expect(screen.getByText('Key Findings')).toBeInTheDocument();
    expect(screen.getByText('GST treatment is not defined')).toBeInTheDocument();
    expect(screen.getByText('Operational Impact')).toBeInTheDocument();
    expect(screen.getByText(sampleSummary.operationalImpact)).toBeInTheDocument();
  });
});

describe('ExecutiveSummaryCard absence handling', () => {
  it('is not rendered by parent when summary is absent', () => {
    const { container } = render(<div data-testid="report-body" />);
    expect(container.querySelector('[data-testid="report-body"]')?.textContent).toBe('');
    expect(screen.queryByText('Executive Summary')).not.toBeInTheDocument();
  });
});
