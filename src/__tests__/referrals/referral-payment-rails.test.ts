import {
  getConfiguredReferralPaymentRails,
  resolveAvailablePaymentRails,
} from '@/lib/referrals/referral-payment-rails';

describe('referral payment rails', () => {
  it('reads rails from referralCommerce config', () => {
    const configured = getConfiguredReferralPaymentRails({
      referralCommerce: {
        commissionMode: 'referral_commerce',
        enabledPaymentRails: ['wise', 'stripe'],
      },
    });
    expect(configured).toEqual(['wise', 'stripe']);
  });

  it('returns empty when merchant cannot support configured rails', () => {
    const resolved = resolveAvailablePaymentRails({
      checkoutConfig: {
        referralCommerce: { enabledPaymentRails: ['stripe', 'wise'] },
      },
      merchant: { stripe: false, wise: false, hedera: false, manual: false },
    });
    expect(resolved).toEqual([]);
  });

  it('filters invalid rail ids safely', () => {
    const configured = getConfiguredReferralPaymentRails({
      referralPaymentRails: ['stripe', 'invalid', 'hedera'],
    });
    expect(configured).toEqual(['stripe', 'hedera']);
  });
});
