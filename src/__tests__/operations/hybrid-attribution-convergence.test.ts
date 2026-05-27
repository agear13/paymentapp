import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { applyCompensationProfileToParticipant } from '@/lib/participants/participant-compensation';
import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  deriveCommissionScope,
  deriveCompensationPreviewText,
  deriveAgreementEligibleServicesCopy,
  isCatalogScopedCommission,
} from '@/lib/operations/derivations/commission-scope';
import {
  canGenerateAttributionLink,
  isAttributionEnabled,
} from '@/lib/operations/truth/attribution-eligibility';
import { deriveReferralCommerceFromCompensationProfile } from '@/lib/referrals/derive-referral-commerce-from-profile';
import { deriveAttributionExplanation } from '@/lib/operations/truth/attribution-truth';
import {
  formatCompensationPercent,
  formatFixedPayoutLine,
} from '@/lib/projects/participant-compensation-copy';
import {
  assertAttributionConvergenceInvariants,
  assertConvergenceInvariants,
  OperationalInvariantViolation,
} from '@/lib/operations/dev/operational-invariants';
import {
  PLATFORM_FALLBACK_CURRENCY,
  resolveCatalogDefaultCurrency,
} from '@/lib/currency/resolve-catalog-default-currency';

function baseDeal(): RecentDeal {
  return {
    id: 'deal-1',
    dealName: 'Test',
    partner: 'Test',
    value: 1000,
    introducer: '—',
    closer: '—',
    status: 'Pending',
    lastUpdated: new Date().toISOString(),
    paymentStatus: 'Not Paid',
    setupStatus: 'configuring',
    projectValueCurrency: 'USD',
  } as RecentDeal;
}

function hybridAttributionParticipant(
  profileOverrides: Partial<DemoParticipant['compensationProfile']> = {}
): DemoParticipant {
  const base = buildProjectParticipant({
    name: 'Promoter',
    role: 'Partner',
    project: baseDeal(),
    participationModel: 'revenue_share',
    commissionKind: 'fixed_amount',
    commissionValue: 500,
    enableCustomerAttribution: false,
  });
  return applyCompensationProfileToParticipant(base, {
    compensationType: 'HYBRID',
    configured: true,
    percentage: 8,
    fixedAmount: 500,
    revenueSources: [],
    customerAttributionEnabled: true,
    commissionSourceMode: 'selected',
    commissionServiceIds: ['svc-vip'],
    ...profileOverrides,
  });
}

describe('hybrid attribution convergence', () => {
  const catalog = [{ id: 'svc-vip', name: 'VIP Package' }];

  it('treats HYBRID + attribution as catalog-scoped commission', () => {
    const p = hybridAttributionParticipant();
    expect(isCatalogScopedCommission(p)).toBe(true);
    expect(isAttributionEnabled(p)).toBe(true);
    expect(canGenerateAttributionLink(p, { catalogItems: catalog })).toBe(true);
  });

  it('renders hybrid attribution in agreement earnings copy', () => {
    const p = hybridAttributionParticipant();
    p.approvalStatus = 'Approved';
    const scope = deriveCommissionScope(p, { catalogItems: catalog, workspaceCurrency: 'USD' });
    expect(scope.settlementBasis).toBe('qualifying_catalog_purchases');
    expect(scope.earningsPrimary).toContain('8% catalog commission');
    expect(scope.earningsPrimary).toContain('Fixed payout');
    expect(scope.earningsPrimary).not.toMatch(/\$8\.00/);

    const agreement = deriveAgreementEligibleServicesCopy(p, { catalogItems: catalog });
    expect(agreement.items).toContain('VIP Package');

    const explanation = deriveAttributionExplanation(p, { catalogItems: catalog });
    expect(explanation.kind).not.toBe('inactive');
    expect(explanation.kind).not.toBe('unavailable_compensation_model');
    expect(explanation.detail).toContain('VIP Package');
  });

  it('formats percentage as percent not currency', () => {
    expect(formatCompensationPercent(8)).toBe('8%');
    expect(formatFixedPayoutLine(500, 'USD')).toContain('$500');
    expect(formatFixedPayoutLine(8, 'USD')).not.toBe('8%');
  });

  it('derives referral commerce from HYBRID compensation profile', () => {
    const p = hybridAttributionParticipant();
    const commerce = deriveReferralCommerceFromCompensationProfile(p);
    expect(commerce?.commissionMode).toBe('referral_commerce');
    expect(commerce?.commerceCommissionPct).toBe(8);
    expect(commerce?.enabledServiceIds).toEqual(['svc-vip']);
  });

  it('supports all active services scope for HYBRID attribution', () => {
    const p = hybridAttributionParticipant({
      commissionSourceMode: 'all_active',
      commissionServiceIds: [],
    });
    const scope = deriveCommissionScope(p, {
      catalogItems: [
        { id: 'svc-1', name: 'Early Bird' },
        { id: 'svc-2', name: 'VIP Package' },
      ],
    });
    expect(scope.isAllActiveCatalog).toBe(true);
    expect(scope.earningsSecondary).toBe('All active services');
    expect(deriveCompensationPreviewText(p, { catalogItems: catalog })).toContain(
      'all active customer-facing catalog items'
    );
  });

  it('throws HYBRID_ATTRIBUTION_NOT_RENDERED_IN_AGREEMENT in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertAttributionConvergenceInvariants({ hybridAttributionNotRenderedInAgreement: true })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });

  it('throws PERCENTAGE_RENDERED_AS_CURRENCY in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertAttributionConvergenceInvariants({ percentageRenderedAsCurrency: true })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });

  it('throws CATALOG_SURFACE_CURRENCY_CONTRADICTS_WORKSPACE in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertConvergenceInvariants({ catalogSurfaceCurrencyContradictsWorkspace: true })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });
});

describe('catalog currency hydration hierarchy', () => {
  it('onboarding USD → catalog defaults USD over merchant AUD', () => {
    expect(
      resolveCatalogDefaultCurrency({
        workspaceDefaultCurrency: 'USD',
        merchantDefaultCurrency: 'AUD',
      })
    ).toBe('USD');
  });

  it('onboarding AUD → catalog defaults AUD', () => {
    expect(
      resolveCatalogDefaultCurrency({
        workspaceDefaultCurrency: 'AUD',
      })
    ).toBe('AUD');
  });

  it('falls back to platform currency when workspace and merchant absent', () => {
    expect(resolveCatalogDefaultCurrency({})).toBe(PLATFORM_FALLBACK_CURRENCY);
  });
});
