import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  deriveCommissionScope,
  deriveCompensationPreviewText,
  deriveCommissionSettlementBasis,
  isCatalogScopedCommission,
  isProjectWideRevenueShare,
} from '@/lib/operations/derivations/commission-scope';

function catalogCommissionParticipant(
  overrides: Partial<DemoParticipant> = {}
): DemoParticipant {
  return {
    id: 'p-cat',
    name: 'Promoter',
    email: 'p@example.com',
    role: 'Contributor',
    commissionKind: 'pct_deal_value',
    commissionValue: 10,
    status: 'Pending',
    approvalStatus: 'Pending approval',
    inviteToken: 'tok',
    participationModel: 'customer_attribution',
    compensationProfile: {
      compensationType: 'COMMISSION',
      configured: true,
      percentage: 10,
      customerAttributionEnabled: true,
      commissionSourceMode: 'selected',
      commissionServiceIds: ['svc-early-bird'],
    },
    referralCommerce: {
      commissionMode: 'referral_commerce',
      commerceCommissionPct: 10,
      enabledServiceIds: ['svc-early-bird'],
    },
    ...overrides,
  } as DemoParticipant;
}

describe('catalog commission presentation', () => {
  const catalog = [{ id: 'svc-early-bird', name: 'Early Bird Tickets' }];

  it('derives catalog commission scope for selected services', () => {
    const scope = deriveCommissionScope(catalogCommissionParticipant(), { catalogItems: catalog });
    expect(scope.settlementBasis).toBe('qualifying_catalog_purchases');
    expect(scope.earningsPrimary).toBe('10% catalog commission');
    expect(scope.earningsSecondary).toBe('Eligible: Early Bird Tickets');
    expect(scope.scopeDescription).toContain('qualifying customer purchases');
  });

  it('never uses deal value language for catalog commission', () => {
    const scope = deriveCommissionScope(catalogCommissionParticipant(), { catalogItems: catalog });
    expect(scope.earningsPrimary).not.toMatch(/deal value/i);
    expect(scope.earningsPrimary).not.toMatch(/revenue share/i);
    expect(scope.scopeDescription).not.toMatch(/deal value/i);
  });

  it('supports all active catalog services copy', () => {
    const scope = deriveCommissionScope(
      catalogCommissionParticipant({
        compensationProfile: {
          compensationType: 'COMMISSION',
          configured: true,
          percentage: 10,
          customerAttributionEnabled: true,
          commissionSourceMode: 'all_active',
          commissionServiceIds: [],
        },
        referralCommerce: {
          commissionMode: 'referral_commerce',
          commerceCommissionPct: 10,
          enabledServiceIds: [],
        },
      }),
      { catalogItems: catalog }
    );
    expect(scope.earningsSecondary).toBe('All active services');
    expect(scope.scopeDescription).toContain('all qualifying customer purchases');
  });

  it('handles no catalog items assigned', () => {
    const scope = deriveCommissionScope(
      catalogCommissionParticipant({
        compensationProfile: {
          compensationType: 'COMMISSION',
          configured: true,
          percentage: 10,
          customerAttributionEnabled: true,
          commissionSourceMode: 'selected',
          commissionServiceIds: [],
        },
        referralCommerce: {
          commissionMode: 'referral_commerce',
          commerceCommissionPct: 10,
          enabledServiceIds: [],
        },
      })
    );
    expect(scope.earningsSecondary).toContain('No qualifying services');
  });

  it('preserves true project revenue share semantics', () => {
    const participant = {
      id: 'p-rev',
      name: 'Closer',
      email: '',
      role: 'Closer',
      commissionKind: 'pct_deal_value',
      commissionValue: 15,
      status: 'Pending',
      approvalStatus: 'Pending approval',
      inviteToken: 'tok2',
      participationModel: 'revenue_share',
      compensationProfile: {
        compensationType: 'REVENUE_SHARE',
        configured: true,
        percentage: 15,
        customerAttributionEnabled: false,
      },
      referralCommerce: {
        commissionMode: 'project_revenue_share',
        commerceCommissionPct: 15,
      },
    } as DemoParticipant;

    expect(isProjectWideRevenueShare(participant)).toBe(true);
    expect(isCatalogScopedCommission(participant)).toBe(false);
    const scope = deriveCommissionScope(participant);
    expect(scope.earningsPrimary).toBe('15% revenue share');
    expect(scope.earningsSecondary).toBe('Project settlement allocation');
    expect(deriveCommissionSettlementBasis(participant)).toBe('project_settlement_allocation');
  });

  it('preview text lists eligible catalog services', () => {
    const text = deriveCompensationPreviewText(catalogCommissionParticipant(), {
      catalogItems: catalog,
    });
    expect(text).toContain('Early Bird Tickets');
    expect(text).not.toMatch(/deal value/i);
  });

  it('preview warns when no qualifying services assigned', () => {
    const text = deriveCompensationPreviewText(
      catalogCommissionParticipant({
        compensationProfile: {
          compensationType: 'COMMISSION',
          configured: true,
          percentage: 10,
          customerAttributionEnabled: true,
          commissionSourceMode: 'selected',
          commissionServiceIds: [],
        },
        referralCommerce: {
          commissionMode: 'referral_commerce',
          commerceCommissionPct: 10,
          enabledServiceIds: [],
        },
      })
    );
    expect(text).toContain('No qualifying services currently assigned');
  });

  it('attribution disabled commission is not catalog scoped when not referral commerce', () => {
    const participant = catalogCommissionParticipant({
      compensationProfile: {
        compensationType: 'COMMISSION',
        configured: true,
        percentage: 10,
        customerAttributionEnabled: false,
        commissionSourceMode: 'selected',
        commissionServiceIds: ['svc-early-bird'],
      },
      referralCommerce: undefined,
    });
    expect(isCatalogScopedCommission(participant)).toBe(false);
  });
});
