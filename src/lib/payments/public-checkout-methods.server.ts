import 'server-only';

import type { PaymentMethod } from '@prisma/client';
import config from '@/lib/config/env';
import {
  paymentLinkAllowsMultiCheckoutRail,
  paymentLinkIsDedicatedRail,
} from '@/lib/payments/payment-link-rail-access';
import { resolveMerchantEvmWallet } from '@/lib/payments/evm-wallet-rail.server';
import {
  filterPaymentMethodsByReferralRails,
  merchantRailAvailabilityFromSettings,
  resolveAvailablePaymentRails,
} from '@/lib/referrals/referral-payment-rails';

export type PublicCheckoutMethodFlags = {
  stripe: boolean;
  hedera: boolean;
  wise: boolean;
  crypto: boolean;
  manualBank: boolean;
  metamask: boolean;
};

type MerchantCheckoutSettings = {
  stripe_account_id?: string | null;
  hedera_account_id?: string | null;
  evm_wallet_address?: string | null;
  wise_enabled?: boolean | null;
  wise_profile_id?: string | null;
} | null;

export function resolvePublicCheckoutMethods(input: {
  invoiceOnly: boolean;
  lockedPaymentMethod: PaymentMethod | null | undefined;
  merchantSettings: MerchantCheckoutSettings;
  referralCheckoutConfig?: unknown;
}): PublicCheckoutMethodFlags {
  const pm = input.lockedPaymentMethod;
  const merchant = input.merchantSettings;
  const invoiceOnly = input.invoiceOnly;

  const allowsStripe = paymentLinkAllowsMultiCheckoutRail(pm, 'STRIPE');
  const allowsHedera = paymentLinkAllowsMultiCheckoutRail(pm, 'HEDERA');
  const allowsWise = paymentLinkAllowsMultiCheckoutRail(pm, 'WISE');
  const allowsEvmWallet =
    !invoiceOnly && paymentLinkAllowsMultiCheckoutRail(pm, 'EVM_WALLET');
  const allowsCrypto = !invoiceOnly && paymentLinkIsDedicatedRail(pm, 'CRYPTO');
  const allowsManualBank =
    !invoiceOnly && paymentLinkIsDedicatedRail(pm, 'MANUAL_BANK');

  const globalWiseEnabled = config.features.wisePayments;
  const evmMerchantWallet = resolveMerchantEvmWallet(merchant);
  const metamaskAvailable =
    config.features.evmWalletPayments && allowsEvmWallet && !!evmMerchantWallet;

  const linkAllowsWise =
    allowsWise && (!pm || pm === 'WISE');
  const merchantWiseConfigured = !!merchant?.wise_enabled && !!merchant?.wise_profile_id;
  const wiseAvailable = globalWiseEnabled && linkAllowsWise && merchantWiseConfigured;

  let methods: PublicCheckoutMethodFlags = {
    stripe: !invoiceOnly && allowsStripe && !!merchant?.stripe_account_id,
    hedera: !invoiceOnly && allowsHedera && !!merchant?.hedera_account_id,
    wise: !invoiceOnly && allowsWise && wiseAvailable,
    crypto: allowsCrypto,
    manualBank: allowsManualBank,
    metamask: metamaskAvailable,
  };

  if (input.referralCheckoutConfig) {
    const resolvedRails = resolveAvailablePaymentRails({
      checkoutConfig: input.referralCheckoutConfig,
      merchant: merchantRailAvailabilityFromSettings(merchant, {
        globalWiseEnabled: config.features.wisePayments,
      }),
    });
    if (resolvedRails.length > 0) {
      methods = {
        ...filterPaymentMethodsByReferralRails({
          methods,
          resolvedRails,
        }),
        crypto: methods.crypto,
        manualBank: methods.manualBank,
        metamask: methods.metamask,
      };
    }
  }

  return methods;
}

export function resolveEvmMerchantWalletForCheckout(
  merchantSettings: MerchantCheckoutSettings
): string | null {
  return resolveMerchantEvmWallet(merchantSettings);
}
