import {
  isAttributionAllActiveWithoutCatalog,
  canGenerateAttributionLink,
} from '@/lib/operations/truth/attribution-eligibility';
import {
  assertConvergenceInvariants,
  assertOperationalInvariants,
  OperationalInvariantViolation,
} from '@/lib/operations/dev/operational-invariants';
import {
  PLATFORM_FALLBACK_CURRENCY,
  resolveCatalogDefaultCurrency,
} from '@/lib/currency/resolve-catalog-default-currency';
import { applyCompensationProfileToParticipant } from '@/lib/participants/participant-compensation';
import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';

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
  } as RecentDeal;
}

describe('attribution catalog integrity', () => {
  it('blocks attribution + all_active when active catalog is empty', () => {
    expect(
      isAttributionAllActiveWithoutCatalog({
        compensationType: 'COMMISSION',
        customerAttributionEnabled: true,
        commissionSourceMode: 'all_active',
        activeCatalogCount: 0,
      })
    ).toBe(true);
  });

  it('allows attribution once active services exist', () => {
    expect(
      isAttributionAllActiveWithoutCatalog({
        compensationType: 'COMMISSION',
        customerAttributionEnabled: true,
        commissionSourceMode: 'all_active',
        activeCatalogCount: 2,
      })
    ).toBe(false);
  });

  it('does not block standard fixed-fee compensation without services', () => {
    expect(
      isAttributionAllActiveWithoutCatalog({
        compensationType: 'FIXED_FEE',
        customerAttributionEnabled: false,
        commissionSourceMode: 'all_active',
        activeCatalogCount: 0,
      })
    ).toBe(false);
  });

  it('allows commission without attribution when catalog is empty', () => {
    expect(
      isAttributionAllActiveWithoutCatalog({
        compensationType: 'COMMISSION',
        customerAttributionEnabled: false,
        commissionSourceMode: 'all_active',
        activeCatalogCount: 0,
      })
    ).toBe(false);
  });

  it('allows attribution with selected services mode (selection validated separately)', () => {
    expect(
      isAttributionAllActiveWithoutCatalog({
        compensationType: 'COMMISSION',
        customerAttributionEnabled: true,
        commissionSourceMode: 'selected',
        activeCatalogCount: 0,
      })
    ).toBe(false);
  });

  it('blocks hybrid attribution + all_active when active catalog is empty', () => {
    expect(
      isAttributionAllActiveWithoutCatalog({
        compensationType: 'HYBRID',
        customerAttributionEnabled: true,
        commissionSourceMode: 'all_active',
        activeCatalogCount: 0,
      })
    ).toBe(true);
  });

  it('allows hybrid attribution once active services exist', () => {
    expect(
      isAttributionAllActiveWithoutCatalog({
        compensationType: 'HYBRID',
        customerAttributionEnabled: true,
        commissionSourceMode: 'all_active',
        activeCatalogCount: 1,
      })
    ).toBe(false);
  });

  it('allows hybrid without attribution when catalog is empty', () => {
    expect(
      isAttributionAllActiveWithoutCatalog({
        compensationType: 'HYBRID',
        customerAttributionEnabled: false,
        commissionSourceMode: 'all_active',
        activeCatalogCount: 0,
      })
    ).toBe(false);
  });

  it('allows hybrid with selected services mode', () => {
    expect(
      isAttributionAllActiveWithoutCatalog({
        compensationType: 'HYBRID',
        customerAttributionEnabled: true,
        commissionSourceMode: 'selected',
        activeCatalogCount: 0,
      })
    ).toBe(false);
  });

  it('allows attribution links after services are added for all_active commission', () => {
    const p = buildProjectParticipant({
      name: 'Venue',
      role: 'Partner',
      project: baseDeal(),
      participationModel: 'customer_attribution',
      commissionKind: 'pct_deal_value',
      commissionValue: 10,
      enableCustomerAttribution: true,
    });
    const configured = applyCompensationProfileToParticipant(p, {
      compensationType: 'COMMISSION',
      percentage: 10,
      configured: true,
      revenueSources: [],
      customerAttributionEnabled: true,
      commissionSourceMode: 'all_active',
      commissionServiceIds: [],
    });
    expect(
      canGenerateAttributionLink(configured, {
        catalogItems: [{ id: 'svc-1', name: 'VIP Package' }],
      })
    ).toBe(true);
  });

  it('throws ATTRIBUTION_ENABLED_WITHOUT_ACTIVE_SERVICES in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertOperationalInvariants({ attributionEnabledWithoutActiveServices: true })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });
});

describe('catalog default currency hierarchy', () => {
  it('onboarding USD → catalog defaults USD', () => {
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

  it('uses merchant/org currency when workspace default absent', () => {
    expect(
      resolveCatalogDefaultCurrency({
        merchantDefaultCurrency: 'USD',
      })
    ).toBe('USD');
  });

  it('uses platform fallback when no org currency configured', () => {
    expect(resolveCatalogDefaultCurrency({})).toBe(PLATFORM_FALLBACK_CURRENCY);
  });

  it('throws CATALOG_DEFAULT_CURRENCY_MISMATCH in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertConvergenceInvariants({ catalogDefaultCurrencyMismatch: true })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });
});
