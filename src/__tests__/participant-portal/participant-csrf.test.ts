import { CSRF_EXEMPT_PATH_PREFIXES, isCsrfExemptPath } from '@/lib/security/csrf-policy';

describe('participant portal CSRF', () => {
  it('requires CSRF on authenticated payout mutations', () => {
    expect(isCsrfExemptPath('/api/payment-setup/tok/submit')).toBe(false);
    expect(isCsrfExemptPath('/api/payment-setup/tok/upload')).toBe(false);
    expect(CSRF_EXEMPT_PATH_PREFIXES.some((prefix) => prefix.startsWith('/api/payment-setup'))).toBe(
      false
    );
  });

  it('does not treat public commerce checkout as a participant portal', () => {
    expect(isCsrfExemptPath('/api/referral/abc/checkout')).toBe(true);
    expect(isCsrfExemptPath('/api/public/pay/abc/session')).toBe(true);
  });
});
