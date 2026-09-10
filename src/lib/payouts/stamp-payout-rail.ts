import { randomUUID } from 'node:crypto';
import type { PayoutDestinationKind, PayoutMethodType } from '@prisma/client';
import { destinationKindFromPayoutMethodType } from '@/lib/payouts/destination-kind';
import { payoutIdempotencyKey } from '@/lib/payouts/payout-idempotency';
import { selectPayoutRail } from '@/lib/payouts/select-payout-rail';
import type { PayoutRailId } from '@/lib/payouts/rails/types';

export type PayoutRailCreateFields = {
  id: string;
  rail_id: PayoutRailId;
  destination_kind: PayoutDestinationKind | null;
  idempotency_key: string;
};

export function buildPayoutRailCreateFields(input: {
  organizationId: string;
  currency: string;
  methodType?: PayoutMethodType | string | null;
  merchantHederaReady: boolean;
  merchantCregisReady?: boolean;
  destinationHandle?: string | null;
  destinationDetails?: Record<string, unknown> | null;
  payoutAmount?: string;
  payoutId?: string;
}): PayoutRailCreateFields {
  const payoutId = input.payoutId ?? randomUUID();
  const destinationKind = destinationKindFromPayoutMethodType(input.methodType ?? null);
  const railId = selectPayoutRail({
    currency: input.currency,
    destinationKind,
    methodType: input.methodType ?? null,
    merchantHederaReady: input.merchantHederaReady,
    merchantCregisReady: input.merchantCregisReady,
    destinationHandle: input.destinationHandle,
    destinationDetails: input.destinationDetails,
    payoutAmount: input.payoutAmount,
  });

  return {
    id: payoutId,
    rail_id: railId,
    destination_kind: destinationKind,
    idempotency_key: payoutIdempotencyKey(input.organizationId, payoutId),
  };
}
