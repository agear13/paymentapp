/**
 * Single source of truth for which payment rails require Xero settlement accounts.
 */

import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';
import {
  isMultiCheckoutRailConfigured,
  type PaymentLinkRailSetupStatus,
} from '@/lib/payment-links/setup-status';
import type { MerchantDedicatedRailDefaults } from '@/lib/payment-links/merchant-dedicated-rail-defaults';

/** Default manual bank to disabled — only require Wise Holding when explicitly enabled. */
export function normalizeMerchantPaymentRails(rails: MerchantPaymentRails): MerchantPaymentRails {
  return {
    stripeEnabled: rails.stripeEnabled,
    wiseEnabled: rails.wiseEnabled,
    stablecoinSettlementsEnabled: rails.stablecoinSettlementsEnabled,
    manualBankEnabled: rails.manualBankEnabled ?? false,
  };
}

export function buildMerchantPaymentRailsFromSetup(
  railSetup: PaymentLinkRailSetupStatus,
  dedicatedDefaults?: MerchantDedicatedRailDefaults | null
): MerchantPaymentRails {
  const hederaConfigured = isMultiCheckoutRailConfigured(railSetup, 'hedera');
  const evmConfigured = isMultiCheckoutRailConfigured(railSetup, 'evm_wallet');

  return normalizeMerchantPaymentRails({
    stripeEnabled: isMultiCheckoutRailConfigured(railSetup, 'stripe'),
    wiseEnabled: isMultiCheckoutRailConfigured(railSetup, 'wise'),
    stablecoinSettlementsEnabled: hederaConfigured || evmConfigured || Boolean(dedicatedDefaults?.crypto),
    manualBankEnabled: Boolean(dedicatedDefaults?.manualBank),
  });
}

export function merchantHasEnabledPaymentRails(rails: MerchantPaymentRails): boolean {
  const normalized = normalizeMerchantPaymentRails(rails);
  return (
    normalized.stripeEnabled ||
    normalized.wiseEnabled ||
    normalized.stablecoinSettlementsEnabled ||
    normalized.manualBankEnabled
  );
}
