/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { StripeConnectReadinessSummary } from '@/components/commercial-os/stripe-connect-readiness-summary';

jest.mock('@/hooks/use-organization', () => ({
  useOrganization: () => ({ organizationId: 'org-stripe-connected' }),
}));

describe('Starter + Stripe connected entitlement UX', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ stripe_account_id: 'acct_123' }],
    }) as jest.Mock;
  });

  it('shows Stripe connected without implying Payment Links are available', async () => {
    render(<StripeConnectReadinessSummary />);

    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(
      screen.getByText(/Stripe is ready to accept payments once your workspace has access to Payment Links/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/feature_gated/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Stripe isn't configured/i)).not.toBeInTheDocument();
  });
});
