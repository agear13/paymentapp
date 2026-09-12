import type {
  LandingBusinessTrait,
  LandingCostBand,
  LandingPaymentMethodFilter,
  LandingProviderOffering,
  LandingProviderTypeFilter,
  LandingRecipientNeed,
  LandingSetupBand,
  LandingSpeedBand,
} from '@/lib/journey/landing-provider-catalog';
import type { LandingPriorityId, LandingSearchQuery } from '@/lib/journey/landing-route-model';

export type LandingResultFilters = {
  paymentMethods: LandingPaymentMethodFilter[];
  providerTypes: LandingProviderTypeFilter[];
  speed: LandingSpeedBand[];
  cost: LandingCostBand[];
  setup: LandingSetupBand[];
  recipient: LandingRecipientNeed[];
  business: LandingBusinessTrait[];
};

export const PAYMENT_METHOD_OPTIONS: { id: LandingPaymentMethodFilter; label: string }[] = [
  { id: 'bank_transfer', label: 'Bank transfer' },
  { id: 'card', label: 'Card' },
  { id: 'payment_link', label: 'Payment link' },
  { id: 'digital_wallet', label: 'Digital wallet' },
  { id: 'stablecoin', label: 'Digital dollar' },
  { id: 'local_rail', label: 'Local payment rail' },
  { id: 'other', label: 'Other' },
];

export const PROVIDER_TYPE_OPTIONS: { id: LandingProviderTypeFilter; label: string }[] = [
  { id: 'bank', label: 'Banks' },
  { id: 'payment_platform', label: 'Payment platforms' },
  { id: 'fx_transfer', label: 'FX / transfer providers' },
  { id: 'card_processor', label: 'Card processors' },
  { id: 'digital_asset', label: 'Digital-dollar providers' },
];

export const SPEED_OPTIONS: { id: LandingSpeedBand; label: string }[] = [
  { id: 'instant', label: 'Instant' },
  { id: 'same_day', label: 'Same day' },
  { id: 'one_to_two_days', label: '1–2 business days' },
  { id: 'three_plus_days', label: '3+ business days' },
];

export const COST_OPTIONS: { id: LandingCostBand; label: string }[] = [
  { id: 'lowest', label: 'Lowest total cost' },
  { id: 'low_fees', label: 'Low fees' },
  { id: 'best_fx', label: 'Best FX' },
  { id: 'no_monthly', label: 'No monthly commitment' },
];

export const SETUP_OPTIONS: { id: LandingSetupBand; label: string }[] = [
  { id: 'no_account', label: 'No account required' },
  { id: 'existing_account', label: 'Existing account' },
  { id: 'business_account', label: 'Business account' },
  { id: 'additional_setup', label: 'Additional setup required' },
];

export const RECIPIENT_OPTIONS: { id: LandingRecipientNeed; label: string }[] = [
  { id: 'bank_account', label: 'Bank account' },
  { id: 'card', label: 'Card' },
  { id: 'payment_link', label: 'Payment link' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'local_account', label: 'Local account' },
];

export const BUSINESS_OPTIONS: { id: LandingBusinessTrait; label: string }[] = [
  { id: 'business_friendly', label: 'Business-friendly' },
  { id: 'multi_user', label: 'Multi-user' },
  { id: 'accounting', label: 'Accounting integration' },
  { id: 'approvals', label: 'Approval workflows' },
  { id: 'recurring', label: 'Recurring payments' },
];

export type LandingFilterChip = {
  group: keyof LandingResultFilters;
  id: string;
  label: string;
};

const OPTION_MAPS = {
  paymentMethods: PAYMENT_METHOD_OPTIONS,
  providerTypes: PROVIDER_TYPE_OPTIONS,
  speed: SPEED_OPTIONS,
  cost: COST_OPTIONS,
  setup: SETUP_OPTIONS,
  recipient: RECIPIENT_OPTIONS,
  business: BUSINESS_OPTIONS,
} as const;

export function activeFilterChips(filters: LandingResultFilters): LandingFilterChip[] {
  return (Object.keys(OPTION_MAPS) as (keyof typeof OPTION_MAPS)[]).flatMap((group) => {
    const selected = filters[group];
    const options = OPTION_MAPS[group];
    return selected.map((id) => ({
      group,
      id,
      label: options.find((option) => option.id === id)?.label ?? id,
    }));
  });
}

export function recipientScanLabel(needs: LandingRecipientNeed[]): string {
  if (needs.includes('bank_account') || needs.includes('local_account')) return 'Bank account';
  if (needs.includes('wallet')) return 'Compatible wallet';
  if (needs.includes('payment_link')) return 'Payment link';
  if (needs.includes('card')) return 'Card';
  return 'Account';
}

export function setupScanLabel(band: LandingSetupBand): string {
  switch (band) {
    case 'no_account':
      return 'Very low';
    case 'existing_account':
      return 'Low';
    case 'business_account':
      return 'Medium';
    case 'additional_setup':
      return 'High';
  }
}

export function bestForTag(
  offering: LandingProviderOffering,
  query: LandingSearchQuery,
  isRecommended: boolean
): string {
  if (isRecommended) {
    switch (query.priority) {
      case 'best_fit':
        return "Provvy's pick for this payment";
      case 'lowest_cost':
        return 'Best for lowest cost';
      case 'fastest':
        return 'Best for speed';
      case 'simplest':
        return 'Best for existing business setup';
    }
  }
  if (offering.costBands.includes('lowest')) return 'Best for lowest cost';
  if (offering.speedBand === 'instant' || offering.speedBand === 'same_day') return 'Best for speed';
  if (offering.setupBand === 'business_account') return 'Best for existing business setup';
  return 'Best for familiarity';
}

export function recommendationBadge(priority: LandingPriorityId): string {
  switch (priority) {
    case 'best_fit':
      return "Provvy's pick";
    case 'lowest_cost':
      return 'Lowest total cost';
    case 'fastest':
      return 'Fastest';
    case 'simplest':
      return 'Simplest';
  }
}

export function recommendedWhyLine(priority: LandingPriorityId): string {
  switch (priority) {
    case 'best_fit':
      return 'The route that makes the most sense for this payment — not automatically the cheapest.';
    case 'lowest_cost':
      return 'Lowest estimated total cost among the routes shown.';
    case 'fastest':
      return 'Typically the fastest arrival among the routes shown.';
    case 'simplest':
      return 'Lowest setup among the routes that can complete this payment.';
  }
}

export function cheapestOffering<T extends { indicativeCost: number | null }>(
  ranked: T[]
): T | undefined {
  return ranked.reduce<T | undefined>((lowest, current) => {
    if (current.indicativeCost == null) return lowest;
    if (!lowest || lowest.indicativeCost == null || current.indicativeCost < lowest.indicativeCost) {
      return current;
    }
    return lowest;
  }, undefined);
}

export function whyThisRank(
  item: {
    id: string;
    isRecommended: boolean;
    indicativeCost: number | null;
    offering: LandingProviderOffering;
  },
  ranked: Array<{
    id: string;
    isRecommended: boolean;
    indicativeCost: number | null;
    offering: LandingProviderOffering;
  }>,
  query: LandingSearchQuery
): string {
  const cheapest = cheapestOffering(ranked);
  const isCheapest = Boolean(cheapest && cheapest.id === item.id);
  const type = query.transactionType.replace(/_/g, ' ');
  const arrival = item.offering.arrivalLabel.toLowerCase();

  if (item.isRecommended) {
    if (query.priority === 'best_fit' && !isCheapest) {
      return `A little more than the cheapest route today, but a stronger fit for this ${type} — ${arrival}, and better aligned with how this corridor is usually paid.`;
    }
    return recommendedWhyLine(query.priority);
  }

  if (isCheapest && query.priority === 'best_fit') {
    return 'Lowest total cost on this corridor — a strong option if this single transfer is all that matters.';
  }

  if (item.offering.providerId === 'ofx') {
    return 'More relevant for larger or recurring payments, where a specialist FX desk can outweigh the extra friction.';
  }

  if (item.offering.providerId === 'bank') {
    return 'Uses the account you already have. Usually slower and more expensive, but no new provider to open.';
  }

  if (item.offering.speedBand === 'instant' || item.offering.speedBand === 'same_day') {
    return `Faster arrival, with a different cost and setup trade-off than the route Provvy ranked higher.`;
  }

  return `${item.offering.arrivalLabel}. ${item.offering.explanation}`;
}

export function scanTraits(offering: LandingProviderOffering): string[] {
  const traits: string[] = [];
  if (offering.costBands.includes('lowest') || offering.costBands.includes('low_fees')) {
    traits.push('Low cost');
  }
  if (offering.speedBand === 'instant' || offering.speedBand === 'same_day') {
    traits.push('Fast');
  } else if (offering.speedBand === 'one_to_two_days') {
    traits.push('Fast enough');
  }
  if (offering.setupBand === 'no_account' || offering.setupBand === 'existing_account') {
    traits.push('Low setup');
  } else if (offering.setupBand === 'business_account') {
    traits.push('Business setup');
  }
  return traits.slice(0, 3);
}
