/**
 * Maps API / DB payloads to settlement settings used by resolver + UI.
 */

import type { CryptoSettlementStrategy, MerchantSettlementSettings } from '@/lib/accounting/settlement-account-types';

export type SettlementSettingsPayload = MerchantSettlementSettings & {
  crypto_settlement_strategy?: CryptoSettlementStrategy | null;
  cryptoSettlementStrategy?: CryptoSettlementStrategy | null;
};

export function toMerchantSettlementSettings(
  payload: SettlementSettingsPayload | null | undefined
): MerchantSettlementSettings {
  if (!payload) {
    return {};
  }

  const explicitStrategy =
    payload.cryptoSettlementStrategy ?? payload.crypto_settlement_strategy ?? null;

  return {
    xero_stripe_clearing_account_id: payload.xero_stripe_clearing_account_id,
    xero_wise_clearing_account_id: payload.xero_wise_clearing_account_id,
    xero_hbar_clearing_account_id: payload.xero_hbar_clearing_account_id,
    xero_usdc_clearing_account_id: payload.xero_usdc_clearing_account_id,
    xero_usdt_clearing_account_id: payload.xero_usdt_clearing_account_id,
    xero_audd_clearing_account_id: payload.xero_audd_clearing_account_id,
    xero_fee_expense_account_id: payload.xero_fee_expense_account_id,
    cryptoSettlementStrategy: explicitStrategy,
  };
}
