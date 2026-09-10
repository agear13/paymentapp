import { AirwallexPayoutRailAdapter } from '@/lib/payouts/rails/airwallex.adapter';
import { CregisPayoutRailAdapter } from '@/lib/payouts/rails/cregis.adapter';
import { HederaPayoutRailAdapter } from '@/lib/payouts/rails/hedera.adapter';
import { ManualPayoutRailAdapter } from '@/lib/payouts/rails/manual.adapter';
import type { ImplementedPayoutRailId, PayoutRailAdapter, PayoutRailId } from '@/lib/payouts/rails/types';
import { PayoutReleaseError } from '@/lib/payouts/payout-status-transitions';

const ADAPTERS: Record<ImplementedPayoutRailId, PayoutRailAdapter> = {
  manual: ManualPayoutRailAdapter,
  hedera: HederaPayoutRailAdapter,
  cregis: CregisPayoutRailAdapter,
  airwallex: AirwallexPayoutRailAdapter,
};

export function getPayoutRailAdapter(railId: PayoutRailId): PayoutRailAdapter {
  const adapter = ADAPTERS[railId as ImplementedPayoutRailId];
  if (!adapter) {
    throw new PayoutReleaseError(
      'PAYOUT_RAIL_NOT_IMPLEMENTED',
      `Payout rail "${railId}" is not implemented yet`,
      501
    );
  }
  return adapter;
}
