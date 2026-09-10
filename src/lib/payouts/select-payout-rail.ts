import { destinationKindFromPayoutMethodType } from '@/lib/payouts/destination-kind';
import { isCregisDestinationExecutable } from '@/lib/payouts/rails/cregis-currency';
import { getPayoutRail, payoutRailSupportsCurrency } from '@/lib/payouts/rails/registry';
import type { PayoutDestinationKind, PayoutRailId } from '@/lib/payouts/rails/types';
import type { PayoutMethodType } from '@prisma/client';

/**
 * Deterministic Phase 1 rail selector.
 *
 * Returns a canonical Provvy rail_id only. Never calls provider APIs.
 * A future AI layer should replace this function's scoring, not executePayoutRelease().
 *
 * Policy:
 * 1. Hedera first when the method is HEDERA, the merchant is Hedera-ready,
 *    and the currency is a documented Hedera payout currency.
 * 2. Cregis only when the merchant has a selectable Cregis connection
 *    (credentials + sandbox / non-blocked production), the destination is a
 *    non-Hedera wallet with a documented Cregis currency, and the amount can
 *    be submitted without inventing FX. ExecutionEnabled is not required to
 *    stamp the rail; POST /api/payouts/{id}/execute remains the submit gate.
 * 3. Otherwise manual.
 *
 * Airwallex is implemented for sandbox but is never selected here. The
 * customer-funds model (Provvy-owned wallet vs x-on-behalf-of) is unconfirmed.
 */
export type PayoutRailSelectionInput = {
  currency: string;
  destinationKind?: PayoutDestinationKind | null;
  methodType?: PayoutMethodType | string | null;
  merchantHederaReady: boolean;
  merchantCregisReady?: boolean;
  destinationHandle?: string | null;
  destinationDetails?: Record<string, unknown> | null;
  payoutAmount?: string;
};

export function selectPayoutRail(input: PayoutRailSelectionInput): PayoutRailId {
  const destinationKind =
    input.destinationKind ?? destinationKindFromPayoutMethodType(input.methodType ?? null);
  const currency = input.currency.trim().toUpperCase();

  if (
    input.methodType === 'HEDERA' &&
    destinationKind === 'WALLET' &&
    input.merchantHederaReady &&
    payoutRailSupportsCurrency('hedera', currency) &&
    getPayoutRail('hedera').implemented
  ) {
    return 'hedera';
  }

  if (
    input.merchantCregisReady === true &&
    destinationKind === 'WALLET' &&
    input.methodType !== 'HEDERA' &&
    getPayoutRail('cregis').implemented &&
    isCregisDestinationExecutable({
      handle: input.destinationHandle,
      details: input.destinationDetails,
      methodType: input.methodType,
      payoutAmount: input.payoutAmount,
      payoutCurrency: currency,
    })
  ) {
    return 'cregis';
  }

  return 'manual';
}
