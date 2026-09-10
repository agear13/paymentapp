/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { PayoutRailComparison } from '@/components/payouts/payout-rail-comparison';
import { PayoutRailRecommendationCard } from '@/components/payouts/payout-rail-recommendation';
import { PayoutReviewSummary } from '@/components/payouts/payout-review-summary';
import { PayoutStatusBadge } from '@/components/payouts/payout-status-badge';
import { listPayoutRails } from '@/lib/payouts/rails/registry';

describe('payout rail comparison UI', () => {
  it('renders every registered rail and does not invent a Cregis-only table', () => {
    render(
      <PayoutRailComparison
        currency="USD"
        methodType="CRYPTO"
        destinationHandle="TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS"
        destinationDetails={{ asset: 'USDT', network: 'tron' }}
        payoutAmount="25"
        merchantCregisReady
      />
    );

    for (const rail of listPayoutRails()) {
      expect(screen.getByText(rail.displayLabel)).toBeTruthy();
    }
    expect(screen.getAllByText('Not yet estimated').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Recommended').length).toBeGreaterThan(1);
  });

  it('shows an honest pending-destination recommendation', () => {
    render(<PayoutRailRecommendationCard currency="USD" pendingDestination />);
    expect(screen.getByText(/Provvy chooses the payout rail/i)).toBeTruthy();
    expect(screen.getByText(/Registered rails can appear in comparison before they are configured/i)).toBeTruthy();
    expect(screen.queryByText(/recommended route/i)).toBeNull();
  });

  it('labels unconfigured rails as coming soon and does not recommend them', () => {
    render(<PayoutRailComparison currency="USD" hideRecommendation />);
    expect(screen.getAllByText('Coming soon').length).toBeGreaterThan(1);
    expect(screen.getByText('Connect Cregis')).toBeTruthy();
    expect(screen.getByText('Connect Airwallex')).toBeTruthy();
    expect(screen.getAllByText('Recommended')).toHaveLength(1);
  });

  it('recommends Manual as the fallback when no automated rail is available', () => {
    render(
      <PayoutRailRecommendationCard
        currency="USD"
        methodType="BANK_TRANSFER"
        destinationHandle="acct-1"
      />
    );
    expect(screen.getByText('Manual is the available fallback')).toBeTruthy();
  });

  it('reviews a payout without exposing provider execution fields', () => {
    render(
      <PayoutReviewSummary
        recipient="user-123456789"
        amount={25}
        currency="USD"
        methodType="CRYPTO"
        destinationHandle="TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS"
        destinationDetails={{ asset: 'USDT', network: 'tron' }}
        railId="cregis"
        merchantCregisReady
        onConfirm={() => undefined}
      />
    );
    expect(screen.getByText('Payout review')).toBeTruthy();
    expect(screen.getByText('USDT · tron · TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS')).toBeTruthy();
    expect(screen.getByText(/Available/)).toBeTruthy();
    expect(screen.queryByText(/wallet_id/i)).toBeNull();
    expect(screen.queryByText(/from_address/i)).toBeNull();
    expect((screen.getByRole('button', { name: /confirm payout/i }) as HTMLButtonElement).disabled).toBe(
      false
    );
  });

  it('does not allow confirmation on an unconfigured rail', () => {
    render(
      <PayoutReviewSummary
        recipient="user-123456789"
        amount={25}
        currency="USD"
        methodType="BANK_TRANSFER"
        destinationHandle="acct-1"
        railId="airwallex"
        onConfirm={() => undefined}
      />
    );
    expect(screen.getAllByText(/Coming soon/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Connect Airwallex/).length).toBeGreaterThan(0);
    expect(screen.getByText(/cannot be used to confirm or submit/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: /confirm payout/i }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it('presents processing as awaiting authorization for rails that need it', () => {
    render(<PayoutStatusBadge status="PROCESSING" railId="cregis" />);
    expect(screen.getByText('Processing · awaiting authorization')).toBeTruthy();
  });
});
