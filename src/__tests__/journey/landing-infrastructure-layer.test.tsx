/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { LandingInfrastructureLayer } from '@/components/journey/lovable/landing-infrastructure-layer';
import { LANDING_INFRASTRUCTURE_NODES } from '@/lib/journey/landing-infrastructure-layer';

describe('LandingInfrastructureLayer', () => {
  it('renders supported infrastructure nodes without claiming replacement', () => {
    render(<LandingInfrastructureLayer />);

    expect(
      screen.getByRole('heading', { name: /Your existing payment infrastructure/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Connected by Provvy/i)).toBeInTheDocument();
    expect(screen.getByText('Understand → Recommend → Coordinate')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /See all integrations/i })).toHaveAttribute(
      'href',
      '/workspace/connected'
    );
    expect(screen.getByRole('button', { name: /Stripe: Payment rail/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wise: Payment rail/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xero: Accounting/i })).toBeInTheDocument();
    expect(screen.queryByText(/QuickBooks/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/replaces/i)).not.toBeInTheDocument();
  });

  it('only lists integrations that exist in the application', () => {
    const ids = LANDING_INFRASTRUCTURE_NODES.map((node) => node.id);
    expect(ids).toEqual(
      expect.arrayContaining(['stripe', 'wise', 'airwallex', 'metamask', 'hashpack', 'hedera', 'cregis', 'xero'])
    );
    expect(ids).toHaveLength(8);
  });
});
