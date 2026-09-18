/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { LandingBusinessFlows } from '@/components/journey/lovable/landing-business-flows';
import { landingBusinessFlowItems } from '@/lib/journey/landing-business-flows';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';

describe('LandingBusinessFlows', () => {
  it('maps each proof item to an existing public workflow route', () => {
    const items = landingBusinessFlowItems();

    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(item.workflowSlug).toBeTruthy();
      expect(getWorkflowBySlug(item.workflowSlug as string)).toBeDefined();
      expect(item.href).toBe(`/journey/workflows/${item.workflowSlug}`);
    }
  });

  it('renders workflow examples without customer-count claims', () => {
    render(<LandingBusinessFlows />);

    expect(
      screen.getByRole('heading', {
        name: /Different businesses\. Different payment flows\. One coordination layer\./i,
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore workflows/i })).toHaveAttribute(
      'href',
      '#workflow-library'
    );
    expect(screen.getByRole('link', { name: 'The Collective: Partner payments' })).toHaveAttribute(
      'href',
      '/journey/workflows/revenue-sharing'
    );
    expect(screen.getByRole('link', { name: 'Weso: Referral management' })).toHaveAttribute(
      'href',
      '/journey/workflows/referral-management'
    );
    expect(
      screen.getByRole('link', { name: 'Thirsty Turtl: Affiliate & creator programs' })
    ).toHaveAttribute('href', '/journey/workflows/referral-management');
    expect(
      screen.getByRole('link', { name: 'EvolvH34: Web3 payment reconciliation' })
    ).toHaveAttribute('href', '/journey/workflows/autonomous-reconciliation');
    expect(screen.queryByText(/trusted by/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/thousands/i)).not.toBeInTheDocument();
  });
});
