import {
  DEFAULT_SAAS_BILLING_RETURN_PATH,
  resolveBillingPortalReturnUrl,
  resolveSaasCheckoutReturnUrls,
} from '@/lib/billing/saas-billing-return-urls';

const ORIGIN = 'https://app.provvypay.com';

describe('saas-billing-return-urls', () => {
  describe('resolveSaasCheckoutReturnUrls', () => {
    it('builds absolute success and cancel URLs when returnTo is an app path', () => {
      const urls = resolveSaasCheckoutReturnUrls(
        ORIGIN,
        'upgrade',
        '/workspace/settings/team'
      );

      expect(urls.success_url).toBe(
        'https://app.provvypay.com/workspace/settings/team?billing=success'
      );
      expect(urls.cancel_url).toBe(
        'https://app.provvypay.com/workspace/settings/team?billing=canceled'
      );
    });

    it('defaults upgrade checkout to Commercial OS Plan & Billing when returnTo is omitted', () => {
      const urls = resolveSaasCheckoutReturnUrls(ORIGIN, 'upgrade');

      expect(urls.success_url).toBe(
        `${ORIGIN}${DEFAULT_SAAS_BILLING_RETURN_PATH}?billing=success`
      );
      expect(urls.cancel_url).toBe(
        `${ORIGIN}${DEFAULT_SAAS_BILLING_RETURN_PATH}?billing=canceled`
      );
    });

    it('rejects protocol-relative paths that would produce invalid Stripe URLs', () => {
      const urls = resolveSaasCheckoutReturnUrls(ORIGIN, 'upgrade', '//evil.example/phish');

      expect(urls.success_url).toBe(
        `${ORIGIN}${DEFAULT_SAAS_BILLING_RETURN_PATH}?billing=success`
      );
    });

    it('does not pass relative paths to Stripe (regression for "Not a valid URL")', () => {
      const urls = resolveSaasCheckoutReturnUrls(
        ORIGIN,
        'upgrade',
        '/workspace/settings/team'
      );

      expect(urls.success_url.startsWith('https://')).toBe(true);
      expect(urls.cancel_url.startsWith('https://')).toBe(true);
      expect(urls.success_url).not.toBe('/workspace/settings/team?billing=success');
    });
  });

  describe('resolveBillingPortalReturnUrl', () => {
    it('defaults to Commercial OS Plan & Billing', () => {
      expect(resolveBillingPortalReturnUrl(ORIGIN)).toBe(
        `${ORIGIN}${DEFAULT_SAAS_BILLING_RETURN_PATH}`
      );
    });

    it('supports an explicit Commercial OS return path', () => {
      expect(resolveBillingPortalReturnUrl(ORIGIN, '/workspace/settings/plan')).toBe(
        `${ORIGIN}/workspace/settings/plan`
      );
    });

    it('does not return the legacy dashboard billing route by default', () => {
      expect(resolveBillingPortalReturnUrl(ORIGIN)).not.toContain('/dashboard/settings/billing');
    });
  });
});
