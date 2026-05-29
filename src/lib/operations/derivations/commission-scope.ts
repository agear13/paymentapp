import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { ParticipantCompensationProfile } from '@/lib/participants/participant-compensation-types';
import { formatFixedPayoutLine } from '@/lib/projects/participant-compensation-copy';
import { formatCurrency } from '@/lib/formatters/format-currency';
import {
  isCatalogScopedCommission,
  isAllActiveCatalogSource,
} from '@/lib/operations/shared/attribution-compensation-semantics';
import { hasPersistedCompensationTerms } from '@/lib/operations/primitives/participant-earnings-primitives';
import { DEFAULT_WORKSPACE_CURRENCY } from '@/lib/currency/workspace-currencies';
import {
  catalogRefsFromHydrated,
  hydrateEligibleCatalogServices,
} from '@/lib/operations/hydration/hydrate-eligible-catalog-services';
import { assertAgreementHydrationInvariants } from '@/lib/operations/dev/operational-invariants';

export type CommissionSettlementBasis =
  | 'qualifying_catalog_purchases'
  | 'project_settlement_allocation'
  | 'fixed_fee'
  | 'hybrid'
  | 'custom'
  | 'unpaid'
  | 'not_configured';

export type CatalogItemRef = { id: string; name: string };

export type CommissionScopeContext = {
  catalogItems?: CatalogItemRef[];
  workspaceCurrency?: string | null;
};

export {
  isCatalogScopedCommission,
  isAllActiveCatalogSource,
} from '@/lib/operations/shared/attribution-compensation-semantics';

export type CommissionScope = {
  settlementBasis: CommissionSettlementBasis;
  scopeLabel: string;
  scopeDescription: string;
  earningsPrimary: string;
  earningsSecondary: string;
  earningsTitle: string;
  eligibleCatalogItems: CatalogItemRef[];
  isCatalogCommission: boolean;
  isAllActiveCatalog: boolean;
  percentage: number | null;
};

function profileOf(participant: DemoParticipant): ParticipantCompensationProfile | undefined {
  return participant.compensationProfile;
}

function resolvePercentage(
  participant: DemoParticipant,
  profile?: ParticipantCompensationProfile
): number | null {
  const fromProfile = profile?.percentage;
  if (Number.isFinite(fromProfile)) return fromProfile as number;
  if (participant.commissionKind === 'pct_deal_value' && Number.isFinite(participant.commissionValue)) {
    return participant.commissionValue;
  }
  const commercePct = participant.referralCommerce?.commerceCommissionPct;
  if (Number.isFinite(commercePct)) return commercePct as number;
  return null;
}

export function isProjectWideRevenueShare(participant: DemoParticipant): boolean {
  const profile = profileOf(participant);
  if (profile?.compensationType === 'HYBRID') return false;
  if (isCatalogScopedCommission(participant)) return false;
  if (profile?.compensationType === 'REVENUE_SHARE') return true;
  if (participant.participationModel === 'revenue_share') return true;
  if (participant.referralCommerce?.commissionMode === 'project_revenue_share') return true;
  if (participant.commissionKind === 'pct_deal_value') return true;
  return false;
}

function selectedCatalogIds(participant: DemoParticipant): string[] {
  const profile = profileOf(participant);
  const fromProfile = profile?.commissionServiceIds ?? [];
  if (fromProfile.length > 0) return fromProfile;
  return participant.referralCommerce?.enabledServiceIds ?? [];
}

export function deriveCommissionEligibleCatalogItems(
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): CatalogItemRef[] {
  const ids = selectedCatalogIds(participant);
  if (ids.length === 0) return [];

  const hydrated = hydrateEligibleCatalogServices(
    ids,
    (context.catalogItems ?? []).map((item) => ({ id: item.id, name: item.name }))
  );
  const refs = catalogRefsFromHydrated(hydrated);
  assertAgreementHydrationInvariants({ renderedServiceLabels: refs.map((r) => r.name) });
  return refs;
}

export function deriveCommissionSettlementBasis(
  participant: DemoParticipant
): CommissionSettlementBasis {
  const profile = profileOf(participant);
  if (profile?.exemptFromPayout || profile?.compensationType === 'UNPAID_INTERNAL') {
    return 'unpaid';
  }
  if (!hasPersistedCompensationTerms(participant)) {
    return 'not_configured';
  }
  if (isCatalogScopedCommission(participant)) {
    return 'qualifying_catalog_purchases';
  }
  if (isProjectWideRevenueShare(participant)) {
    return 'project_settlement_allocation';
  }
  if (profile?.compensationType === 'FIXED_FEE' || participant.participationModel === 'fixed_payout') {
    return 'fixed_fee';
  }
  if (profile?.compensationType === 'HYBRID') return 'hybrid';
  if (profile?.compensationType === 'CUSTOM') return 'custom';
  if (profile?.compensationType === 'REVENUE_SHARE') return 'project_settlement_allocation';
  if (participant.commissionKind === 'fixed_amount') return 'fixed_fee';
  return 'not_configured';
}

export function deriveCommissionScopeLabel(
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): string {
  return deriveCommissionScope(participant, context).scopeLabel;
}

export function deriveCommissionScopeDescription(
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): string {
  return deriveCommissionScope(participant, context).scopeDescription;
}

export function formatEligibleCatalogLine(items: CatalogItemRef[], maxVisible = 1): {
  line: string;
  title: string;
} {
  if (items.length === 0) {
    return { line: 'No qualifying services assigned', title: 'No qualifying services assigned' };
  }
  const names = items.map((i) => i.name);
  const title = names.join(', ');
  if (names.length <= maxVisible) {
    return { line: `Eligible: ${names.join(', ')}`, title };
  }
  const visible = names.slice(0, maxVisible).join(', ');
  const remaining = names.length - maxVisible;
  return {
    line: `Eligible: ${visible} +${remaining} more`,
    title,
  };
}

export function deriveCommissionLinkRoutingLabel(
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): string | null {
  if (!isCatalogScopedCommission(participant)) return null;
  const items = deriveCommissionEligibleCatalogItems(participant, context);
  const allActive = isAllActiveCatalogSource(participant);

  if (allActive) {
    return 'Customers can purchase qualifying catalog items from your active catalog.';
  }
  if (items.length === 1) {
    return `This participant link currently routes customers to: ${items[0].name}`;
  }
  if (items.length > 1) {
    return `Customers can purchase ${items.length} eligible catalog items.`;
  }
  return 'No qualifying services currently assigned.';
}

export function deriveCommissionScope(
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): CommissionScope {
  const profile = profileOf(participant);
  const pct = resolvePercentage(participant, profile);
  const pctLabel = pct != null ? `${pct}%` : '';
  const basis = deriveCommissionSettlementBasis(participant);
  const catalog = isCatalogScopedCommission(participant);
  const allActive = catalog && isAllActiveCatalogSource(participant);
  const eligible = catalog && !allActive ? deriveCommissionEligibleCatalogItems(participant, context) : [];
  const eligibleLine = allActive
    ? { line: 'All active services', title: 'All active catalog items' }
    : formatEligibleCatalogLine(eligible);

  if (basis === 'not_configured') {
    return {
      settlementBasis: basis,
      scopeLabel: 'Earnings not configured',
      scopeDescription: 'Configure compensation to define how this participant earns.',
      earningsPrimary: 'Earnings not configured',
      earningsSecondary: 'Configure in participant earnings',
      earningsTitle: 'Earnings not configured',
      eligibleCatalogItems: [],
      isCatalogCommission: false,
      isAllActiveCatalog: false,
      percentage: pct,
    };
  }

  if (basis === 'unpaid') {
    return {
      settlementBasis: basis,
      scopeLabel: 'No payout',
      scopeDescription: 'Internal or unpaid role — no payout coordination.',
      earningsPrimary: 'No payout',
      earningsSecondary: 'Unpaid / internal role',
      earningsTitle: 'No payout',
      eligibleCatalogItems: [],
      isCatalogCommission: false,
      isAllActiveCatalog: false,
      percentage: pct,
    };
  }

  if (basis === 'qualifying_catalog_purchases') {
    const scopeLabel = pctLabel ? `${pctLabel} catalog commission` : 'Catalog commission';
    const scopeDescription = allActive
      ? 'Earns commission on all qualifying customer purchases.'
      : 'Earns commission only on qualifying customer purchases.';
    const hybridFixed =
      profile?.compensationType === 'HYBRID' &&
      profile.fixedAmount != null &&
      Number.isFinite(profile.fixedAmount)
        ? formatFixedPayoutLine(
            profile.fixedAmount,
            context.workspaceCurrency ?? DEFAULT_WORKSPACE_CURRENCY
          )
        : null;
    const earningsPrimary = hybridFixed ? `${scopeLabel} + ${hybridFixed}` : scopeLabel;
    return {
      settlementBasis: basis,
      scopeLabel,
      scopeDescription,
      earningsPrimary,
      earningsSecondary: eligibleLine.line,
      earningsTitle: `${earningsPrimary} — ${eligibleLine.title}`,
      eligibleCatalogItems: eligible,
      isCatalogCommission: true,
      isAllActiveCatalog: allActive,
      percentage: pct,
    };
  }

  if (basis === 'project_settlement_allocation') {
    const scopeLabel = pctLabel ? `${pctLabel} revenue share` : 'Revenue share';
    return {
      settlementBasis: basis,
      scopeLabel,
      scopeDescription: 'Earns from project settlement allocation — not catalog checkout attribution.',
      earningsPrimary: scopeLabel,
      earningsSecondary: 'Project settlement allocation',
      earningsTitle: `${scopeLabel} — project settlement allocation`,
      eligibleCatalogItems: [],
      isCatalogCommission: false,
      isAllActiveCatalog: false,
      percentage: pct,
    };
  }

  if (basis === 'fixed_fee') {
    const amount = profile?.fixedAmount ?? participant.commissionValue ?? 0;
    const primary = formatFixedPayoutLine(
      amount,
      context.workspaceCurrency ?? DEFAULT_WORKSPACE_CURRENCY
    );
    return {
      settlementBasis: basis,
      scopeLabel: primary,
      scopeDescription: 'Fixed fee payout on this project.',
      earningsPrimary: primary,
      earningsSecondary: 'Fixed project payout',
      earningsTitle: primary,
      eligibleCatalogItems: [],
      isCatalogCommission: false,
      isAllActiveCatalog: false,
      percentage: pct,
    };
  }

  if (basis === 'hybrid') {
    const currency = context.workspaceCurrency ?? DEFAULT_WORKSPACE_CURRENCY;
    const parts: string[] = [];
    if (pct != null) parts.push(`${pct}% revenue share`);
    if (profile?.fixedAmount != null && Number.isFinite(profile.fixedAmount)) {
      parts.push(formatFixedPayoutLine(profile.fixedAmount, currency));
    }
    const primary = parts.join(' + ') || 'Hybrid compensation';
    return {
      settlementBasis: basis,
      scopeLabel: primary,
      scopeDescription: 'Hybrid compensation — fixed and percentage project earnings.',
      earningsPrimary: primary,
      earningsSecondary: 'Hybrid project payout',
      earningsTitle: primary,
      eligibleCatalogItems: [],
      isCatalogCommission: false,
      isAllActiveCatalog: false,
      percentage: pct,
    };
  }

  const fallback = profile?.compensationType ?? 'Compensation configured';
  return {
    settlementBasis: basis,
    scopeLabel: String(fallback),
    scopeDescription: 'Compensation configured for this participant.',
    earningsPrimary: String(fallback),
    earningsSecondary: 'See compensation settings',
    earningsTitle: String(fallback),
    eligibleCatalogItems: [],
    isCatalogCommission: false,
    isAllActiveCatalog: false,
    percentage: pct,
  };
}

const OPERATIONAL_TABLE_EARNINGS_MAX_LENGTH = 48;

function compactFixedAmountLabel(amount: number, currency: string): string {
  return `${formatCurrency(amount, currency, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} fixed`;
}

/** Dense table-surface earnings label — preserves meaning without verbose phrasing. */
export function formatCompactOperationalEarnings(
  scope: CommissionScope,
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): string {
  const profile = profileOf(participant);
  const currency = context.workspaceCurrency ?? DEFAULT_WORKSPACE_CURRENCY;
  const pct = scope.percentage;

  if (scope.settlementBasis === 'qualifying_catalog_purchases') {
    const pctPart = pct != null ? `${pct}% commission` : 'Catalog commission';
    if (profile?.compensationType === 'HYBRID' && profile.fixedAmount != null) {
      return `${pctPart} + ${compactFixedAmountLabel(profile.fixedAmount, currency)}`;
    }
    return pct != null ? `${pct}% catalog` : 'Catalog commission';
  }

  if (scope.settlementBasis === 'hybrid') {
    const parts: string[] = [];
    if (pct != null) parts.push(`${pct}%`);
    if (profile?.fixedAmount != null && Number.isFinite(profile.fixedAmount)) {
      parts.push(compactFixedAmountLabel(profile.fixedAmount, currency));
    }
    return parts.length > 0 ? `Hybrid · ${parts.join(' + ')}` : 'Hybrid';
  }

  if (scope.settlementBasis === 'project_settlement_allocation') {
    return pct != null ? `${pct}% revenue share` : 'Revenue share';
  }

  if (scope.settlementBasis === 'fixed_fee') {
    const amount = profile?.fixedAmount ?? participant.commissionValue ?? 0;
    return compactFixedAmountLabel(amount, currency);
  }

  if (scope.settlementBasis === 'unpaid') return 'No payout';
  if (scope.settlementBasis === 'not_configured') return 'Not configured';

  return scope.scopeLabel;
}

export function isCompensationSummaryOverflowingOperationalTable(summary: string): boolean {
  if (summary.includes('Fixed payout:')) return true;
  if (summary.length > OPERATIONAL_TABLE_EARNINGS_MAX_LENGTH) return true;
  return false;
}

/** Resolve catalog items for agreement review — independent of approval state. */
export function resolveAgreementCatalogItems(
  participant: DemoParticipant,
  scopedRows: Array<{ id: string; name: string }> = [],
  context: CommissionScopeContext = {}
): CatalogItemRef[] {
  if (!isCatalogScopedCommission(participant)) return [];

  const rowRefs = scopedRows
    .filter((row) => row.id && row.name)
    .map((row) => ({ id: row.id, name: row.name }));

  if (isAllActiveCatalogSource(participant)) {
    if (rowRefs.length > 0) return rowRefs;
    return context.catalogItems ?? [];
  }

  const eligible = deriveCommissionEligibleCatalogItems(participant, {
    ...context,
    catalogItems: rowRefs.length > 0 ? rowRefs : context.catalogItems,
  });
  if (eligible.length > 0) return eligible;
  return rowRefs;
}

export function deriveCompensationPreviewText(
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): string {
  const scope = deriveCommissionScope(participant, context);
  if (scope.settlementBasis === 'unpaid') {
    return 'No payout — internal or unpaid role';
  }
  if (scope.settlementBasis === 'qualifying_catalog_purchases') {
    if (scope.isAllActiveCatalog) {
      return 'Attribution applies to all active customer-facing catalog items.';
    }
    if (scope.eligibleCatalogItems.length === 0) {
      return 'No qualifying services currently assigned. Customers cannot generate attributed commission until services are added.';
    }
    const names = scope.eligibleCatalogItems.map((i) => i.name).join(', ');
    return `Customers referred by this participant can earn attribution on: ${names}`;
  }
  if (scope.settlementBasis === 'project_settlement_allocation') {
    return `${scope.earningsPrimary} — project settlement allocation (not catalog checkout attribution).`;
  }
  return `${scope.earningsPrimary} — stored for readiness only (no settlement calc)`;
}

export function deriveAgreementEligibleServicesCopy(
  participant: DemoParticipant,
  context: CommissionScopeContext = {},
  serviceRows?: Array<{ id: string; name: string }>
): { heading: string; items: string[]; emptyMessage: string } {
  const scope = deriveCommissionScope(participant, context);
  const heading = 'Eligible services/products';

  if (!isCatalogScopedCommission(participant)) {
    return {
      heading,
      items: [],
      emptyMessage: 'This participant does not earn from catalog customer purchases.',
    };
  }

  if (scope.isAllActiveCatalog) {
    return {
      heading,
      items: ['All active catalog items available to customers.'],
      emptyMessage: 'No services/products currently assigned.',
    };
  }

  const fromRows = serviceRows?.map((r) => r.name).filter(Boolean) ?? [];
  const fromScope = scope.eligibleCatalogItems.map((i) => i.name);
  const items = fromRows.length > 0 ? fromRows : fromScope;

  return {
    heading,
    items,
    emptyMessage: 'No services/products currently assigned.',
  };
}
