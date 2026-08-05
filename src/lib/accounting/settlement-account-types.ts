/**
 * Settlement account domain types — rail, collection method, and asset.
 * Phase 1: adapts existing merchant_settings columns; no new tables.
 */

import type { XeroMappingField } from '@/lib/accounting/recommended-accounting-config';
import type { PaymentRailId } from '@/lib/payments/payment-rail-registry';
import type { CollectionMethod } from '@/lib/accounting/collection-method';

/** How payment was received at the settlement layer (Stripe, Wise, Crypto, …). */
export type SettlementPaymentRail = PaymentRailId;

/** What was received — any supported identifier (BTC, USDC, AUD, …). */
export type PaymentAsset = string;

export type CryptoSettlementStrategy = 'shared' | 'per_asset';

export type MerchantSettlementSettings = {
  xero_stripe_clearing_account_id?: string | null;
  xero_wise_clearing_account_id?: string | null;
  xero_hbar_clearing_account_id?: string | null;
  xero_usdc_clearing_account_id?: string | null;
  xero_usdt_clearing_account_id?: string | null;
  xero_audd_clearing_account_id?: string | null;
  xero_fee_expense_account_id?: string | null;
  /** Explicit override when persisted; otherwise inferred from column configuration. */
  cryptoSettlementStrategy?: CryptoSettlementStrategy | null;
};

/** Clearing-account columns on merchant_settings used by settlement resolver. */
export type SettlementClearingMappingField = Extract<
  XeroMappingField,
  keyof MerchantSettlementSettings & XeroMappingField
>;

export function readSettlementMappingCode(
  settings: MerchantSettlementSettings,
  field: SettlementClearingMappingField
): string | null {
  const value = settings[field]?.trim();
  return value ? value : null;
}

export type SettlementAccountScope = 'rail' | 'shared_digital_asset' | 'per_asset';

export type SettlementAccountTarget = {
  scope: SettlementAccountScope;
  paymentRail: SettlementPaymentRail;
  collectionMethod: CollectionMethod | null;
  paymentAsset: PaymentAsset | null;
  mappingField: XeroMappingField | null;
  accountName: string;
  suggestedCode: string;
};

export type SettlementProvisioningGuide = {
  accountName: string;
  accountTypeLabel: string;
  suggestedCode: string;
  mappingField: XeroMappingField;
  intro: string;
};

export type SettlementAccountResolution =
  | {
      status: 'resolved';
      xeroAccountCode: string;
      target: SettlementAccountTarget;
      mappingField: XeroMappingField | null;
    }
  | {
      status: 'unmapped';
      target: SettlementAccountTarget;
      guide: SettlementProvisioningGuide;
    };

export type ResolveSettlementAccountInput = {
  organizationId?: string;
  paymentRail: SettlementPaymentRail | string;
  collectionMethod?: CollectionMethod | string | null;
  paymentAsset?: PaymentAsset | string | null;
  settings: MerchantSettlementSettings;
};

export type SettlementContext = {
  paymentRail: SettlementPaymentRail;
  collectionMethod: CollectionMethod | null;
  paymentAsset: PaymentAsset | null;
};
