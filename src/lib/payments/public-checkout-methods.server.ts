import 'server-only';

import type { PaymentMethod } from '@prisma/client';
import config from '@/lib/config/env';
import { resolveMerchantEvmWallet } from '@/lib/payments/evm-wallet-rail.server';
import {
  PAYMENT_RAIL_REGISTRY,
  paymentLinkAllowsCheckoutRail,
  type PaymentRailId,
  type PublicCheckoutMethodKey,
} from '@/lib/payments/payment-rail-registry';
import {
  filterPaymentMethodsByReferralRails,
  merchantRailAvailabilityFromSettings,
  resolveAvailablePaymentRails,
} from '@/lib/referrals/referral-payment-rails';

export type PublicCheckoutMethodFlags = Record<PublicCheckoutMethodKey, boolean>;

type MerchantCheckoutSettings = {
  stripe_account_id?: string | null;
  hedera_account_id?: string | null;
  evm_wallet_address?: string | null;
  wise_enabled?: boolean | null;
  wise_profile_id?: string | null;
} | null;

type CheckoutAvailabilityContext = {
  invoiceOnly: boolean;
  lockedPaymentMethod: PaymentMethod | null | undefined;
  merchant: MerchantCheckoutSettings;
};

function emptyCheckoutFlags(): PublicCheckoutMethodFlags {
  return {
    stripe: false,
    hedera: false,
    wise: false,
    metamask: false,
    crypto: false,
    manualBank: false,
  };
}

const RAIL_AVAILABILITY: Record<
  PaymentRailId,
  (ctx: CheckoutAvailabilityContext) => boolean
> = {
  stripe: (ctx) =>
    !ctx.invoiceOnly &&
    paymentLinkAllowsCheckoutRail(ctx.lockedPaymentMethod, 'STRIPE') &&
    !!ctx.merchant?.stripe_account_id,

  hedera: (ctx) =>
    !ctx.invoiceOnly &&
    paymentLinkAllowsCheckoutRail(ctx.lockedPaymentMethod, 'HEDERA') &&
    !!ctx.merchant?.hedera_account_id,

  wise: (ctx) => {
    const allowsWise = paymentLinkAllowsCheckoutRail(ctx.lockedPaymentMethod, 'WISE');
    const linkAllowsWise =
      allowsWise &&
      (!ctx.lockedPaymentMethod || ctx.lockedPaymentMethod === 'WISE');
    const merchantWiseConfigured =
      !!ctx.merchant?.wise_enabled && !!ctx.merchant?.wise_profile_id;
    return (
      !ctx.invoiceOnly &&
      allowsWise &&
      config.features.wisePayments &&
      linkAllowsWise &&
      merchantWiseConfigured
    );
  },

  evm_wallet: (ctx) => {
    const allowsEvmWallet =
      !ctx.invoiceOnly &&
      paymentLinkAllowsCheckoutRail(ctx.lockedPaymentMethod, 'EVM_WALLET');
    const merchantWallet = resolveMerchantEvmWallet(ctx.merchant);
    return config.features.evmWalletPayments && allowsEvmWallet && !!merchantWallet;
  },

  crypto: (ctx) =>
    !ctx.invoiceOnly &&
    paymentLinkAllowsCheckoutRail(ctx.lockedPaymentMethod, 'CRYPTO'),

  manual_bank: (ctx) =>
    !ctx.invoiceOnly &&
    paymentLinkAllowsCheckoutRail(ctx.lockedPaymentMethod, 'MANUAL_BANK'),
};

export function resolvePublicCheckoutMethods(input: {
  invoiceOnly: boolean;
  lockedPaymentMethod: PaymentMethod | null | undefined;
  merchantSettings: MerchantCheckoutSettings;
  referralCheckoutConfig?: unknown;
}): PublicCheckoutMethodFlags {
  const ctx: CheckoutAvailabilityContext = {
    invoiceOnly: input.invoiceOnly,
    lockedPaymentMethod: input.lockedPaymentMethod,
    merchant: input.merchantSettings,
  };

  const methods = emptyCheckoutFlags();
  for (const rail of PAYMENT_RAIL_REGISTRY) {
    if (RAIL_AVAILABILITY[rail.id](ctx)) {
      methods[rail.publicCheckoutKey] = true;
    }
  }

  if (!input.referralCheckoutConfig) {
    return methods;
  }

  const resolvedRails = resolveAvailablePaymentRails({
    checkoutConfig: input.referralCheckoutConfig,
    merchant: merchantRailAvailabilityFromSettings(input.merchantSettings, {
      globalWiseEnabled: config.features.wisePayments,
    }),
  });

  if (resolvedRails.length === 0) {
    return methods;
  }

  const filtered = filterPaymentMethodsByReferralRails({
    methods,
    resolvedRails,
  });

  return {
    ...filtered,
    crypto: methods.crypto,
    manualBank: methods.manualBank,
    metamask: methods.metamask,
  };
}

export function resolveEvmMerchantWalletForCheckout(
  merchantSettings: MerchantCheckoutSettings
): string | null {
  return resolveMerchantEvmWallet(merchantSettings);
}
