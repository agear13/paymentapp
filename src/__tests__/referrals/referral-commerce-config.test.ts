import {
  filterServicesForReferralConfig,
  getScopedServiceIds,
  isProjectRevenueShareServiceScoped,
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

  const rmRevenueShareConfig = {
    referralCommerce: {
      commissionMode: 'project_revenue_share',
      commerceCommissionPct: 20,
      enabledServiceIds: ['a'],
    },
  };

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

  it('A: RM revenue-share checkout is limited to the configured service', () => {
    const filtered = filterServicesForReferralConfig(services, rmRevenueShareConfig);
    expect(filtered.map((s) => s.id)).toEqual(['a']);
    expect(getScopedServiceIds(rmRevenueShareConfig)).toEqual(['a']);
    expect(isProjectRevenueShareServiceScoped(rmRevenueShareConfig)).toBe(true);
  });

  it('C: RM revenue-share does not allow purchasing a different service', () => {
    expect(isServiceAllowedForReferral(rmRevenueShareConfig, 'a')).toBe(true);
    expect(isServiceAllowedForReferral(rmRevenueShareConfig, 'b')).toBe(false);
  });

  it('D: RM revenue-share does not fall back to every service when the configured one is missing', () => {
    const remaining = filterServicesForReferralConfig(
      [
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
      ],
      rmRevenueShareConfig
    );
    expect(remaining).toEqual([]);
    expect(isProjectRevenueShareServiceScoped(rmRevenueShareConfig)).toBe(true);
  });

  it('E: referral_commerce behaviour is unchanged', () => {
    const openCatalog = {
      referralCommerce: {
        commissionMode: 'referral_commerce',
        enabledServiceIds: [],
      },
    };
    expect(getScopedServiceIds(openCatalog)).toBeNull();
    expect(filterServicesForReferralConfig(services, openCatalog)).toHaveLength(3);
    expect(isProjectRevenueShareServiceScoped(openCatalog)).toBe(false);

    const scoped = {
      referralCommerce: {
        commissionMode: 'referral_commerce',
        enabledServiceIds: ['b'],
      },
    };
    expect(filterServicesForReferralConfig(services, scoped).map((s) => s.id)).toEqual(['b']);
    expect(isProjectRevenueShareServiceScoped(scoped)).toBe(false);
  });

  it('E: unscoped project_revenue_share still exposes the full catalogue', () => {
    const config = {
      referralCommerce: {
        commissionMode: 'project_revenue_share',
        enabledServiceIds: [],
      },
    };
    expect(getScopedServiceIds(config)).toBeNull();
    expect(isProjectRevenueShareServiceScoped(config)).toBe(false);
    expect(filterServicesForReferralConfig(services, config)).toHaveLength(3);
  });

  it('F: a foreign-org service id is not exposed from this organization catalogue', () => {
    const foreignConfig = {
      referralCommerce: {
        commissionMode: 'project_revenue_share',
        enabledServiceIds: ['org-b-service'],
      },
    };
    expect(filterServicesForReferralConfig(services, foreignConfig)).toEqual([]);
    expect(isServiceAllowedForReferral(foreignConfig, 'a')).toBe(false);
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
