import { destinationKindFromPayoutMethodType } from '@/lib/payouts/destination-kind';
import { isCregisDestinationExecutable } from '@/lib/payouts/rails/cregis-currency';
import {
  getPayoutRail,
  payoutRailSupportsCurrency,
  payoutRailSupportsDestination,
} from '@/lib/payouts/rails/registry';
import type { PayoutDestinationKind, PayoutRailId } from '@/lib/payouts/rails/types';

export type PayoutRailReadinessFlags = {
  merchantHederaReady?: boolean;
  merchantCregisReady?: boolean;
  merchantAirwallexReady?: boolean;
};

export type PayoutRailAvailabilityStatus = 'available' | 'coming_soon' | 'not_available';

export type PayoutRailAvailability = {
  railId: PayoutRailId;
  registered: true;
  configured: boolean;
  compatible: boolean;
  available: boolean;
  status: PayoutRailAvailabilityStatus;
  label: string;
  connectHint: string | null;
  reason: string | null;
  reasonCode: string;
  destinationKindLabel: string;
};

export function payoutRailDestinationKindLabel(railId: PayoutRailId): string {
  switch (railId) {
    case 'airwallex':
    case 'stripe_treasury':
      return 'Bank transfer';
    case 'cregis':
      return 'Crypto payout';
    case 'hedera':
      return 'Hedera payout';
    case 'manual':
      return 'Manual payout';
    default: {
      const _exhaustive: never = railId;
      return _exhaustive;
    }
  }
}

export function isPayoutRailConfigured(
  railId: PayoutRailId,
  flags: PayoutRailReadinessFlags
): boolean {
  switch (railId) {
    case 'manual':
      return true;
    case 'hedera':
      return flags.merchantHederaReady === true;
    case 'cregis':
      return flags.merchantCregisReady === true;
    case 'airwallex':
      return flags.merchantAirwallexReady === true;
    case 'stripe_treasury':
      return false;
    default: {
      const _exhaustive: never = railId;
      return _exhaustive;
    }
  }
}

function connectHintFor(railId: PayoutRailId): string | null {
  switch (railId) {
    case 'cregis':
      return 'Connect Cregis';
    case 'airwallex':
      return 'Connect Airwallex';
    case 'hedera':
      return 'Connect Hedera';
    case 'stripe_treasury':
    case 'manual':
      return null;
    default: {
      const _exhaustive: never = railId;
      return _exhaustive;
    }
  }
}

function railEligibleForPayout(input: {
  railId: PayoutRailId;
  currency: string;
  destinationKind: PayoutDestinationKind | null;
  methodType?: string | null;
  destinationHandle?: string | null;
  destinationDetails?: Record<string, unknown> | null;
  payoutAmount?: string;
}): { eligible: boolean; reason: string | null; reasonCode: string } {
  const rail = getPayoutRail(input.railId);
  if (input.railId === 'manual') {
    return { eligible: true, reason: null, reasonCode: 'AVAILABLE' };
  }
  if (!rail.implemented || rail.health === 'unavailable') {
    return {
      eligible: false,
      reason: 'This rail is registered but not available for payouts yet',
      reasonCode: 'NOT_IMPLEMENTED',
    };
  }
  if (!payoutRailSupportsDestination(input.railId, input.destinationKind)) {
    return {
      eligible: false,
      reason: 'This destination is not supported by this rail',
      reasonCode: 'INCOMPATIBLE_DESTINATION',
    };
  }
  if (input.railId === 'hedera') {
    if (input.methodType !== 'HEDERA') {
      return {
        eligible: false,
        reason: 'Hedera payouts require a Hedera wallet destination',
        reasonCode: 'INCOMPATIBLE_DESTINATION',
      };
    }
    if (!payoutRailSupportsCurrency('hedera', input.currency)) {
      return {
        eligible: false,
        reason: 'This currency is not a documented Hedera payout currency',
        reasonCode: 'UNSUPPORTED_CURRENCY',
      };
    }
    return { eligible: true, reason: null, reasonCode: 'AVAILABLE' };
  }
  if (input.railId === 'cregis') {
    if (
      !isCregisDestinationExecutable({
        handle: input.destinationHandle,
        details: input.destinationDetails,
        methodType: input.methodType,
        payoutAmount: input.payoutAmount,
        payoutCurrency: input.currency,
      })
    ) {
      return {
        eligible: false,
        reason: 'This crypto destination is not eligible for Cregis without inventing FX',
        reasonCode: 'INELIGIBLE_DESTINATION',
      };
    }
    return { eligible: true, reason: null, reasonCode: 'AVAILABLE' };
  }
  if (input.railId === 'airwallex') {
    if (!payoutRailSupportsCurrency('airwallex', input.currency)) {
      return {
        eligible: false,
        reason: 'This currency is not in the documented Airwallex payout set',
        reasonCode: 'UNSUPPORTED_CURRENCY',
      };
    }
    return { eligible: true, reason: null, reasonCode: 'AVAILABLE' };
  }
  return {
    eligible: false,
    reason: 'This rail is registered but not available for payouts yet',
    reasonCode: 'NOT_IMPLEMENTED',
  };
}

export function assessPayoutRailAvailability(input: {
  railId: PayoutRailId;
  currency: string;
  methodType?: string | null;
  destinationKind?: PayoutDestinationKind | null;
  destinationHandle?: string | null;
  destinationDetails?: Record<string, unknown> | null;
  payoutAmount?: string;
  selectedRailId?: PayoutRailId | null;
  pendingDestination?: boolean;
  merchantHederaReady?: boolean;
  merchantCregisReady?: boolean;
  merchantAirwallexReady?: boolean;
}): PayoutRailAvailability {
  const flags: PayoutRailReadinessFlags = {
    merchantHederaReady: input.merchantHederaReady,
    merchantCregisReady: input.merchantCregisReady,
    merchantAirwallexReady: input.merchantAirwallexReady,
  };
  const destinationKind =
    input.destinationKind ?? destinationKindFromPayoutMethodType(input.methodType ?? null);
  const pendingDestination =
    input.pendingDestination === true ||
    (!input.methodType && !input.destinationKind && !input.destinationHandle);
  const rail = getPayoutRail(input.railId);
  const configured = isPayoutRailConfigured(input.railId, flags);
  const compatible = pendingDestination
    ? true
    : input.railId === 'manual' || payoutRailSupportsDestination(input.railId, destinationKind);

  if (pendingDestination) {
    if (input.railId === 'manual') {
      return {
        railId: input.railId,
        registered: true,
        configured: true,
        compatible: true,
        available: true,
        status: 'available',
        label: 'Available',
        connectHint: null,
        reason: 'Manual is the fallback until an automated rail is configured and eligible',
        reasonCode: 'AVAILABLE',
        destinationKindLabel: payoutRailDestinationKindLabel(input.railId),
      };
    }
    if (!rail.implemented || rail.health === 'unavailable') {
      return {
        railId: input.railId,
        registered: true,
        configured: false,
        compatible: true,
        available: false,
        status: 'coming_soon',
        label: 'Coming soon',
        connectHint: null,
        reason: 'This rail is registered but not available for payouts yet',
        reasonCode: 'NOT_IMPLEMENTED',
        destinationKindLabel: payoutRailDestinationKindLabel(input.railId),
      };
    }
    if (!configured) {
      return {
        railId: input.railId,
        registered: true,
        configured: false,
        compatible: true,
        available: false,
        status: 'coming_soon',
        label: 'Coming soon',
        connectHint: connectHintFor(input.railId),
        reason: `${rail.displayLabel} is registered but not configured for this workspace`,
        reasonCode: 'NOT_CONFIGURED',
        destinationKindLabel: payoutRailDestinationKindLabel(input.railId),
      };
    }
    return {
      railId: input.railId,
      registered: true,
      configured: true,
      compatible: true,
      available: false,
      status: 'not_available',
      label: 'Not available yet',
      connectHint: null,
      reason: 'Available once a destination is selected',
      reasonCode: 'DESTINATION_PENDING',
      destinationKindLabel: payoutRailDestinationKindLabel(input.railId),
    };
  }

  const eligibility = railEligibleForPayout({
    railId: input.railId,
    currency: input.currency,
    destinationKind,
    methodType: input.methodType,
    destinationHandle: input.destinationHandle,
    destinationDetails: input.destinationDetails,
    payoutAmount: input.payoutAmount,
  });

  const available =
    rail.implemented &&
    rail.health !== 'unavailable' &&
    configured &&
    eligibility.eligible;

  let status: PayoutRailAvailabilityStatus;
  let label: string;
  let connectHint: string | null = null;
  let reason: string | null = eligibility.reason;
  let reasonCode = eligibility.reasonCode;

  if (available) {
    status = 'available';
    label = 'Available';
    reason = null;
    reasonCode = 'AVAILABLE';
  } else if (!rail.implemented || rail.health === 'unavailable') {
    status = 'coming_soon';
    label = 'Coming soon';
    reason = 'This rail is registered but not available for payouts yet';
    reasonCode = 'NOT_IMPLEMENTED';
  } else if (!configured) {
    status = compatible ? 'coming_soon' : 'not_available';
    label = compatible ? 'Coming soon' : 'Not available yet';
    connectHint = compatible ? connectHintFor(input.railId) : null;
    reason = compatible
      ? `${rail.displayLabel} is registered but not configured for this workspace`
      : 'This destination is not supported by this rail';
    reasonCode = compatible ? 'NOT_CONFIGURED' : 'INCOMPATIBLE_DESTINATION';
  } else {
    status = 'not_available';
    label = 'Not available yet';
    reason = eligibility.reason;
    reasonCode = eligibility.reasonCode;
  }

  return {
    railId: input.railId,
    registered: true,
    configured,
    compatible,
    available,
    status,
    label,
    connectHint,
    reason,
    reasonCode,
    destinationKindLabel: payoutRailDestinationKindLabel(input.railId),
  };
}
