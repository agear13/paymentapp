import {
  assessPayoutRailAvailability,
  type PayoutRailAvailabilityStatus,
} from '@/lib/payouts/payout-rail-availability';
import {
  CREGIS_USD_STABLECOIN_ASSETS,
  resolveCregisDestination,
  resolveCregisSubmitAmount,
} from '@/lib/payouts/rails/cregis-currency';
import { getPayoutRail, listPayoutRails } from '@/lib/payouts/rails/registry';
import type { PayoutDestinationKind, PayoutRailId } from '@/lib/payouts/rails/types';
import { selectPayoutRail } from '@/lib/payouts/select-payout-rail';

export const NOT_YET_ESTIMATED = 'Not yet estimated';
export const NOT_AVAILABLE = 'Not available';

export type PayoutRailComparisonRow = {
  railId: PayoutRailId;
  label: string;
  destinationKindLabel: string;
  registered: boolean;
  configured: boolean;
  compatible: boolean;
  compatibilityLabel: string;
  available: boolean;
  inUse: boolean;
  availabilityStatus: PayoutRailAvailabilityStatus;
  availabilityLabel: string;
  connectHint: string | null;
  unavailabilityReason: string | null;
  estimatedCost: string;
  estimatedCostKnown: boolean;
  estimatedSettlementSpeed: string;
  estimatedSettlementKnown: boolean;
  typicalSettlement: string;
  fxRequirement: string;
  recommended: boolean;
  reasonCodes: string[];
};

export type PayoutRecommendationReason = {
  label: string;
  detail: string;
};

export type PayoutRailRecommendation = {
  railId: PayoutRailId;
  label: string;
  destinationSummary: string | null;
  reasons: PayoutRecommendationReason[];
};

export function payoutDestinationTypeLabel(methodType?: string | null): string {
  switch (methodType) {
    case 'CRYPTO':
      return 'Crypto wallet';
    case 'HEDERA':
      return 'Hedera wallet';
    case 'PAYPAL':
      return 'PayPal';
    case 'WISE':
      return 'Wise';
    case 'BANK_TRANSFER':
      return 'Bank transfer';
    case 'MANUAL_NOTE':
      return 'Manual note';
    default:
      return methodType?.replace(/_/g, ' ') || 'Unknown';
  }
}

export function formatPayoutRecipient(userId?: string | null): string {
  if (!userId) return 'Unknown recipient';
  return userId.length > 12 ? `${userId.slice(0, 8)}…` : userId;
}

export function payoutRailLabel(railId: string | null | undefined): string {
  if (!railId) return 'Not selected';
  try {
    return getPayoutRail(railId as PayoutRailId).displayLabel;
  } catch {
    return railId;
  }
}

export function formatPayoutDestination(input: {
  methodType?: string | null;
  handle?: string | null;
  hederaAccountId?: string | null;
  details?: Record<string, unknown> | null;
}): string {
  const details = input.details ?? null;
  const asset = typeof details?.asset === 'string' ? details.asset : null;
  const network = typeof details?.network === 'string' ? details.network : null;
  const address =
    (typeof details?.address === 'string' && details.address) || input.handle || null;

  if (input.methodType === 'CRYPTO') {
    return [asset, network, address].filter(Boolean).join(' · ') || 'Crypto wallet';
  }
  if (input.methodType === 'HEDERA') {
    return input.hederaAccountId || input.handle || 'Hedera wallet';
  }
  if (input.methodType) {
    return [input.methodType.replaceAll('_', ' '), input.handle].filter(Boolean).join(' · ');
  }
  return input.handle || 'No destination';
}

export function payoutFxImplication(input: {
  railId?: string | null;
  currency?: string | null;
  methodType?: string | null;
  details?: Record<string, unknown> | null;
  payoutAmount?: string | null;
}): string {
  const currency = input.currency?.trim().toUpperCase() ?? '';
  if (input.methodType === 'CRYPTO' || input.railId === 'cregis') {
    const destination = resolveCregisDestination({
      handle: null,
      details: input.details,
    });
    if (destination) {
      const amount = resolveCregisSubmitAmount({
        payoutAmount: input.payoutAmount ?? '',
        payoutCurrency: currency,
        details: input.details,
        record: destination.record,
      });
      if (amount?.source === 'usd_stablecoin') {
        return `USD can be sent as ${destination.record.asset} without FX`;
      }
      if (amount?.source === 'explicit_token_amount' || amount?.source === 'token_units_flag') {
        return 'Token amount is explicit — no FX is invented';
      }
      if (currency === 'AUD' && CREGIS_USD_STABLECOIN_ASSETS.has(destination.record.asset)) {
        return 'AUD → USDT/USDC is not eligible without an explicit token amount';
      }
      return 'Token amount cannot be determined without inventing FX';
    }
    return 'Crypto destination FX is not yet determined';
  }
  if (input.railId === 'hedera') {
    return 'No FX — paid as a Hedera token in the payout currency';
  }
  if (input.railId === 'manual') {
    return 'Operator records the off-platform transfer; FX is not estimated';
  }
  if (input.railId === 'airwallex') {
    return 'Airwallex quotes FX and fees at submit; the adapter does not invent a corridor rate';
  }
  return NOT_YET_ESTIMATED;
}

export function recommendPayoutRail(input: {
  currency: string;
  methodType?: string | null;
  destinationKind?: PayoutDestinationKind | null;
  destinationHandle?: string | null;
  destinationDetails?: Record<string, unknown> | null;
  payoutAmount?: string;
  merchantHederaReady?: boolean;
  merchantCregisReady?: boolean;
  merchantAirwallexReady?: boolean;
  selectedRailId?: PayoutRailId | null;
  pendingDestination?: boolean;
}): PayoutRailRecommendation {
  const selected = input.selectedRailId ?? null;
  const selectedAvailability = selected
    ? assessPayoutRailAvailability({ ...input, railId: selected, selectedRailId: selected })
    : null;
  const selectedUsable = Boolean(selected && selectedAvailability?.available);

  const selectorRailId = selectPayoutRail({
    currency: input.currency,
    methodType: input.methodType,
    destinationKind: input.destinationKind,
    destinationHandle: input.destinationHandle,
    destinationDetails: input.destinationDetails,
    payoutAmount: input.payoutAmount,
    merchantHederaReady: input.merchantHederaReady === true,
    merchantCregisReady: input.merchantCregisReady === true,
  });
  const selectorAvailability = assessPayoutRailAvailability({
    ...input,
    railId: selectorRailId,
    selectedRailId: selected,
  });
  const railId = selectedUsable
    ? selected!
    : selectorAvailability.available
      ? selectorRailId
      : 'manual';
  const availability = assessPayoutRailAvailability({
    ...input,
    railId,
    selectedRailId: selected,
  });
  const destination = resolveCregisDestination({
    handle: input.destinationHandle,
    details: input.destinationDetails,
  });
  const destinationSummary = destination
    ? `${destination.record.asset} → ${destination.record.network.toUpperCase()}`
    : input.methodType === 'HEDERA'
      ? 'Hedera wallet'
      : null;

  return {
    railId,
    label: payoutRailLabel(railId),
    destinationSummary,
    reasons: [
      {
        label: 'Compatible destination',
        detail: input.methodType
          ? payoutDestinationTypeLabel(input.methodType)
          : destinationSummary || NOT_AVAILABLE,
      },
      {
        label: 'Supported currency/network',
        detail: destinationSummary || (input.methodType === 'HEDERA' ? input.currency.toUpperCase() : NOT_AVAILABLE),
      },
      { label: 'Estimated cost', detail: NOT_YET_ESTIMATED },
      { label: 'Estimated settlement speed', detail: NOT_YET_ESTIMATED },
      {
        label: 'Availability',
        detail: availability.connectHint
          ? `${availability.label} · ${availability.connectHint}`
          : availability.reason
            ? `${availability.label} — ${availability.reason}`
            : availability.label,
      },
    ],
  };
}

export function buildPayoutRailComparison(input: {
  currency: string;
  methodType?: string | null;
  destinationKind?: PayoutDestinationKind | null;
  destinationHandle?: string | null;
  destinationDetails?: Record<string, unknown> | null;
  payoutAmount?: string;
  merchantHederaReady?: boolean;
  merchantCregisReady?: boolean;
  merchantAirwallexReady?: boolean;
  selectedRailId?: PayoutRailId | null;
  hideRecommendation?: boolean;
  pendingDestination?: boolean;
}): PayoutRailComparisonRow[] {
  const pendingDestination = input.pendingDestination === true || input.hideRecommendation === true;
  const comparisonInput = { ...input, pendingDestination };
  const recommended = recommendPayoutRail(comparisonInput);
  const recommendedAvailable = assessPayoutRailAvailability({
    ...comparisonInput,
    railId: recommended.railId,
  }).available;

  return listPayoutRails().map((rail) => {
    const availability = assessPayoutRailAvailability({
      ...comparisonInput,
      railId: rail.railId,
    });
    const inUse = input.selectedRailId === rail.railId;
    const recommendedHere =
      !input.hideRecommendation &&
      recommendedAvailable &&
      availability.available &&
      rail.railId === recommended.railId;
    const reasonCodes = Array.from(
      new Set([
        'REGISTERED',
        availability.configured ? 'CONFIGURED' : 'NOT_CONFIGURED',
        availability.compatible ? 'COMPATIBLE_DESTINATION' : 'INCOMPATIBLE_DESTINATION',
        availability.reasonCode,
        ...(recommendedHere ? ['RECOMMENDED'] : []),
        ...(!rail.supportsQuote ? ['COST_NOT_QUOTED'] : []),
      ])
    );

    return {
      railId: rail.railId,
      label: rail.displayLabel,
      destinationKindLabel: availability.destinationKindLabel,
      registered: true,
      configured: availability.configured,
      compatible: availability.compatible,
      compatibilityLabel: pendingDestination ? 'Pending' : availability.compatible ? 'Yes' : 'No',
      available: availability.available,
      inUse,
      availabilityStatus: availability.status,
      availabilityLabel: availability.label,
      connectHint: availability.connectHint,
      unavailabilityReason: availability.available ? null : availability.reason,
      estimatedCost: NOT_YET_ESTIMATED,
      estimatedCostKnown: false,
      estimatedSettlementSpeed: NOT_YET_ESTIMATED,
      estimatedSettlementKnown: false,
      typicalSettlement: rail.typicalSettlementHint,
      fxRequirement: payoutFxImplication({
        railId: rail.railId,
        currency: input.currency,
        methodType: input.methodType,
        details: input.destinationDetails,
        payoutAmount: input.payoutAmount,
      }),
      recommended: recommendedHere,
      reasonCodes,
    };
  });
}
