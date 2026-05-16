import {
  filterServicesForReferralConfig,
  isServiceAllowedForReferral,
  normalizeReferralCommerce,
  shouldIssueReferralLink,
} from '@/lib/referrals/referral-commerce-config';

describe('referral-commerce-config', () => {
  const services = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
  ];

  it('allows all services when no commerce scope', () => {
    expect(filterServicesForReferralConfig(services, null)).toHaveLength(3);
  });

  it('filters to enabled service ids in referral_commerce mode', () => {
    const config = {
      referralCommerce: {
        commissionMode: 'referral_commerce',
        enabledServiceIds: ['a', 'c'],
      },
    };
    const filtered = filterServicesForReferralConfig(services, config);
    expect(filtered.map((s) => s.id)).toEqual(['a', 'c']);
    expect(isServiceAllowedForReferral(config, 'b')).toBe(false);
    expect(isServiceAllowedForReferral(config, 'a')).toBe(true);
  });

  it('issues referral link by default', () => {
    expect(shouldIssueReferralLink(undefined)).toBe(true);
    expect(shouldIssueReferralLink({ createReferralLink: false, commissionMode: 'project_revenue_share' })).toBe(
      false
    );
  });

  it('normalizes commerce pct', () => {
    const n = normalizeReferralCommerce({
      commissionMode: 'referral_commerce',
      commerceCommissionPct: 15,
    });
    expect(n.commerceCommissionPct).toBe(15);
  });
});
