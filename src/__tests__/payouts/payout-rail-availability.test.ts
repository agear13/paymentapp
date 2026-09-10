import {
  assessPayoutRailAvailability,
  isPayoutRailConfigured,
} from '@/lib/payouts/payout-rail-availability';
import { listPayoutRails } from '@/lib/payouts/rails/registry';

const USDT_TRON = {
  currency: 'USD',
  methodType: 'CRYPTO' as const,
  destinationHandle: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
  destinationDetails: {
    address: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
    asset: 'USDT',
    network: 'tron',
  },
  payoutAmount: '25',
};

const BANK_USD = {
  currency: 'USD',
  methodType: 'BANK_TRANSFER' as const,
  destinationHandle: 'acct-1',
};

describe('payout rail availability', () => {
  it('treats every registry rail as registered and never hardcodes a provider as ready', () => {
    for (const rail of listPayoutRails()) {
      const availability = assessPayoutRailAvailability({
        railId: rail.railId,
        ...USDT_TRON,
      });
      expect(availability.registered).toBe(true);
      if (rail.railId !== 'manual') {
        expect(availability.configured).toBe(false);
        expect(availability.available).toBe(false);
      }
    }
    expect(isPayoutRailConfigured('airwallex', {})).toBe(false);
    expect(isPayoutRailConfigured('cregis', {})).toBe(false);
  });

  it('marks Cregis coming soon until the workspace is configured', () => {
    const availability = assessPayoutRailAvailability({
      railId: 'cregis',
      ...USDT_TRON,
    });
    expect(availability.status).toBe('coming_soon');
    expect(availability.label).toBe('Coming soon');
    expect(availability.connectHint).toBe('Connect Cregis');
    expect(availability.available).toBe(false);
    expect(availability.reasonCode).toBe('NOT_CONFIGURED');
  });

  it('makes Cregis available and eligible for USDT TRON only when configured', () => {
    const availability = assessPayoutRailAvailability({
      railId: 'cregis',
      ...USDT_TRON,
      merchantCregisReady: true,
    });
    expect(availability.configured).toBe(true);
    expect(availability.available).toBe(true);
    expect(availability.status).toBe('available');
    expect(availability.label).toBe('Available');
  });

  it('marks Airwallex coming soon until sandbox or production configuration is present', () => {
    const availability = assessPayoutRailAvailability({
      railId: 'airwallex',
      ...BANK_USD,
    });
    expect(availability.destinationKindLabel).toBe('Bank transfer');
    expect(availability.status).toBe('coming_soon');
    expect(availability.connectHint).toBe('Connect Airwallex');
    expect(availability.available).toBe(false);
  });

  it('can mark Airwallex available for a bank destination when configured, without recommending it', () => {
    const availability = assessPayoutRailAvailability({
      railId: 'airwallex',
      ...BANK_USD,
      merchantAirwallexReady: true,
    });
    expect(availability.available).toBe(true);
    expect(availability.status).toBe('available');
  });

  it('does not treat a stamped unconfigured rail as executable', () => {
    const availability = assessPayoutRailAvailability({
      railId: 'airwallex',
      ...BANK_USD,
      selectedRailId: 'airwallex',
    });
    expect(availability.available).toBe(false);
    expect(availability.configured).toBe(false);
  });

  it('keeps Stripe Treasury coming soon because it is registered but not implemented', () => {
    const availability = assessPayoutRailAvailability({
      railId: 'stripe_treasury',
      ...BANK_USD,
    });
    expect(availability.status).toBe('coming_soon');
    expect(availability.label).toBe('Coming soon');
    expect(availability.available).toBe(false);
    expect(availability.reasonCode).toBe('NOT_IMPLEMENTED');
  });

  it('keeps Manual available as the fallback', () => {
    const availability = assessPayoutRailAvailability({
      railId: 'manual',
      ...USDT_TRON,
    });
    expect(availability.available).toBe(true);
    expect(availability.configured).toBe(true);
    expect(availability.destinationKindLabel).toBe('Manual payout');
  });

  it('shows registered rails as coming soon during destination discovery', () => {
    const cregis = assessPayoutRailAvailability({
      railId: 'cregis',
      currency: 'USD',
      pendingDestination: true,
    });
    expect(cregis.status).toBe('coming_soon');
    expect(cregis.connectHint).toBe('Connect Cregis');
    expect(cregis.reasonCode).toBe('NOT_CONFIGURED');
    expect(cregis.available).toBe(false);

    const airwallex = assessPayoutRailAvailability({
      railId: 'airwallex',
      currency: 'USD',
      pendingDestination: true,
      merchantAirwallexReady: true,
    });
    expect(airwallex.configured).toBe(true);
    expect(airwallex.available).toBe(false);
    expect(airwallex.reasonCode).toBe('DESTINATION_PENDING');
  });
});
