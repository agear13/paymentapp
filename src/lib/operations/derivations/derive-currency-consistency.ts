import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { ParticipantCompensationProfile } from '@/lib/participants/participant-compensation-types';
import { PLATFORM_FALLBACK_CURRENCY } from '@/lib/currency/resolve-catalog-default-currency';
import { isCatalogScopedCommission } from '@/lib/operations/derivations/commission-scope';

export type CurrencyConsistencyWarning = {
  code: string;
  severity: 'warning' | 'blocking';
  message: string;
};

export type CurrencyConsistencyInput = {
  project?: RecentDeal | null;
  projectCurrency?: string | null;
  payoutCurrency?: string | null;
  serviceCurrencies?: string[];
  obligationCurrency?: string | null;
  releaseCurrency?: string | null;
};

export function deriveCurrencyConsistencyWarnings(
  input: CurrencyConsistencyInput
): CurrencyConsistencyWarning[] {
  const warnings: CurrencyConsistencyWarning[] = [];
  const projectCurrency = (
    input.projectCurrency ??
    input.payoutCurrency ??
    PLATFORM_FALLBACK_CURRENCY
  ).toUpperCase();
  const currencies = new Set<string>([projectCurrency]);

  for (const c of input.serviceCurrencies ?? []) {
    if (c?.trim()) currencies.add(c.toUpperCase());
  }
  if (input.obligationCurrency) currencies.add(input.obligationCurrency.toUpperCase());
  if (input.releaseCurrency) currencies.add(input.releaseCurrency.toUpperCase());

  if (currencies.size > 1) {
    warnings.push({
      code: 'CURRENCY_INCONSISTENCY',
      severity: 'blocking',
      message: `Currency mismatch (${[...currencies].join(', ')}). Release and obligation funding are blocked until resolved.`,
    });
  }

  const nonProject = [...currencies].filter((c) => c !== projectCurrency);
  if (nonProject.length > 0 && currencies.size === 2) {
    warnings.push({
      code: 'service_currency_mismatch',
      severity: 'blocking',
      message: `Service catalog uses ${nonProject.join(', ')} while project default is ${projectCurrency}.`,
    });
  }

  return warnings;
}

export type CompensationAttributionNormalization = {
  profile: ParticipantCompensationProfile;
  warnings: string[];
  autoEnabledAttribution: boolean;
  clearedCatalogSelection: boolean;
};

/**
 * Enforce strict separation between settlement allocation and catalog attribution commission.
 * Selected catalog services without attribution → auto-enable attribution.
 * Revenue share with attribution flag → clear attribution + catalog selection.
 */
export function normalizeCompensationAttributionSemantics(
  participant: DemoParticipant,
  profile: ParticipantCompensationProfile
): CompensationAttributionNormalization {
  const warnings: string[] = [];
  let next = { ...profile };
  let autoEnabledAttribution = false;
  let clearedCatalogSelection = false;

  const hasCatalogSelection =
    next.commissionSourceMode === 'selected' &&
    (next.commissionServiceIds?.length ?? 0) > 0;

  if (next.compensationType === 'REVENUE_SHARE' || participant.participationModel === 'revenue_share') {
    if (next.customerAttributionEnabled || hasCatalogSelection) {
      next = {
        ...next,
        customerAttributionEnabled: false,
        commissionSourceMode: 'all_active',
        commissionServiceIds: [],
      };
      clearedCatalogSelection = true;
      warnings.push(
        'Revenue share uses project settlement allocation — customer attribution was disabled.'
      );
    }
    return { profile: next, warnings, autoEnabledAttribution, clearedCatalogSelection };
  }

  if (
    (next.compensationType === 'COMMISSION' ||
      next.compensationType === 'HYBRID' ||
      isCatalogScopedCommission({ ...participant, compensationProfile: next })) &&
    hasCatalogSelection &&
    !next.customerAttributionEnabled
  ) {
    next = { ...next, customerAttributionEnabled: true };
    autoEnabledAttribution = true;
    warnings.push(
      'Qualifying catalog services require customer attribution — attribution was enabled automatically.'
    );
  }

  if (
    next.customerAttributionEnabled &&
    next.compensationType !== 'COMMISSION' &&
    next.compensationType !== 'HYBRID' &&
    !isCatalogScopedCommission({ ...participant, compensationProfile: next })
  ) {
    warnings.push(
      'Customer attribution applies only to catalog commission earnings — configure COMMISSION or HYBRID type for service-level payouts.'
    );
  }

  return { profile: next, warnings, autoEnabledAttribution, clearedCatalogSelection };
}
