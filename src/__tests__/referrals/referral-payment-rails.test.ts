import {
  getConfiguredReferralPaymentRails,
  resolveAvailablePaymentRails,
  resolveReferralPaymentLinkMethod,
  filterPaymentMethodsByReferralRails,
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

  it('leaves payment method unset when multiple referral rails are available', () => {
    const method = resolveReferralPaymentLinkMethod({
      checkoutConfig: {
        referralCommerce: { enabledPaymentRails: ['stripe', 'hedera'] },
      },
      merchant: { stripe: true, wise: false, hedera: true, manual: false },
    });
    expect(method).toBeNull();
  });

  it('locks payment method when only one referral rail resolves', () => {
    const method = resolveReferralPaymentLinkMethod({
      checkoutConfig: {
        referralCommerce: { enabledPaymentRails: ['stripe', 'hedera'] },
      },
      merchant: { stripe: true, wise: false, hedera: false, manual: false },
    });
    expect(method).toBe('STRIPE');
  });

  it('filters public pay methods by referral rails', () => {
    const filtered = filterPaymentMethodsByReferralRails({
      methods: { stripe: true, hedera: true, wise: true },
      resolvedRails: ['stripe', 'hedera'],
    });
    expect(filtered).toEqual({ stripe: true, hedera: true, wise: false });
  });
});
