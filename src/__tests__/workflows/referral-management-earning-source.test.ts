import {
  inferAudienceDiscountPctFromText,
  inferReferralEarningSource,
  normalizeReferralEarningSource,
  validateExternalEarningSource,
} from '@/lib/workflows/referral-management/earning-source';

describe('Referral Management earning-source inference', () => {
  it('classifies a Provvy catalogue conversation as internal', () => {
    expect(
      inferReferralEarningSource({
        evidenceText: 'Affiliate earns 10% on Provvy consulting service.',
      })
    ).toMatchObject({
      type: 'internal_service',
      externalProvider: null,
      externalService: null,
    });
  });

  it('classifies a Weso discount-code conversation as external without inventing a service id', () => {
    expect(
      inferReferralEarningSource({
        evidenceText:
          "We'd love you to be an affiliate for Weso. You'll have a unique discount code. You'll earn 2% of qualifying revenue.",
      })
    ).toEqual({
      type: 'external',
      externalProvider: 'weso',
      externalProviderLabel: 'Weso',
      externalService: null,
      attributionMethod: 'discount_code',
    });
  });

  it('keeps an evidenced Weso app label and does not invent a Weso service id', () => {
    expect(
      inferReferralEarningSource({
        evidenceText: 'Promote Weso app to their audience using a unique discount code',
      })
    ).toMatchObject({
      type: 'external',
      externalProvider: 'weso',
      externalService: 'Weso app',
      attributionMethod: 'discount_code',
    });
  });

  it('does not invent an external platform from a missing catalogue match', () => {
    expect(
      inferReferralEarningSource({
        evidenceText: 'Affiliate earns 10% on Unknown Offer',
      })
    ).toMatchObject({ type: 'internal_service' });
  });

  it('normalizes external source keys for later webhook attribution', () => {
    expect(
      normalizeReferralEarningSource({
        type: 'external',
        externalProvider: 'Weso',
        externalService: 'Weso App Store',
        attributionMethod: 'discount_code',
      })
    ).toMatchObject({
      type: 'external',
      externalProvider: 'weso',
      externalService: 'weso_app_store',
      attributionMethod: 'discount_code',
      externalIdentifier: null,
      metadata: {
        providerLabel: 'Weso',
        serviceLabel: 'Weso App Store',
      },
    });
  });

  it('requires an external platform and allows a pending service label', () => {
    expect(validateExternalEarningSource({ type: 'external', externalProvider: '' })).toBe(
      'Enter the external platform this affiliate earns on.'
    );
    expect(
      validateExternalEarningSource({
        type: 'external',
        externalProvider: 'Weso',
        externalService: '',
      })
    ).toBeNull();
  });

  it('extracts an evidenced audience discount and does not treat commission as a discount', () => {
    expect(
      inferAudienceDiscountPctFromText(
        "Danielle invites Rachel to become a Weso affiliate. Rachel's audience receives 10% off Weso. Rachel receives 2% revenue share on qualifying referred revenue."
      )
    ).toBe(10);
    expect(
      inferAudienceDiscountPctFromText('Affiliate earns 2% revenue share on qualifying referred revenue.')
    ).toBeNull();
    expect(inferAudienceDiscountPctFromText('Affiliate earns 10% on Provvy consulting service.')).toBeNull();
  });
});
