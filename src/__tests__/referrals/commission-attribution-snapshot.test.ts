import {
  buildCommissionAttributionMetadataFromReferralLink,
  isCompleteCommissionAttributionMetadata,
} from '@/lib/referrals/commission-attribution-snapshot';

describe('commission-attribution-snapshot', () => {
  it('builds split metadata with referral_link_id and referral_splits', () => {
    const md = buildCommissionAttributionMetadataFromReferralLink({
      id: 'rl-1',
      organization_id: 'org-1',
      code: 'ABC',
      referral_link_splits: [
        {
          id: 'sp-1',
          label: 'Partner 1',
          percentage: 5,
          beneficiary_id: null,
          sort_order: 0,
        },
      ],
      referral_rules: [],
    });
    expect(md.referral_link_id).toBe('rl-1');
    expect(md.referral_code).toBe('ABC');
    expect(md.referral_splits).toContain('sp-1');
    expect(isCompleteCommissionAttributionMetadata(md as Record<string, string>)).toBe(true);
  });

  it('builds legacy rule metadata', () => {
    const md = buildCommissionAttributionMetadataFromReferralLink({
      id: 'rl-2',
      organization_id: 'org-1',
      code: 'XYZ',
      referral_link_splits: [],
      referral_rules: [
        {
          consultant_id: 'c-1',
          bd_partner_id: 'b-1',
          consultant_pct: 0.1,
          bd_partner_pct: 0.05,
          basis: 'GROSS',
        },
      ],
    });
    expect(md.consultant_id).toBe('c-1');
    expect(md.bd_partner_id).toBe('b-1');
    expect(isCompleteCommissionAttributionMetadata(md as Record<string, string>)).toBe(true);
  });

  it('marks incomplete metadata when referral_link_id missing', () => {
    expect(isCompleteCommissionAttributionMetadata({ referral_splits: '[]' } as never)).toBe(false);
  });
});
