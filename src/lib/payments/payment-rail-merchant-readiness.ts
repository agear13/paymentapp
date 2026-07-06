/**

 * Merchant payment-rail readiness — derived from the Payment Rail Registry.

 * Client-safe (no Prisma / server-only imports).

 */



import type { PaymentMethod } from '@prisma/client';

import { isEvmWalletAddressConfigured } from '@/lib/payments/evm-wallet-config';

import {

  getDedicatedCheckoutRails,

  getMultiCheckoutRailIds,

  getMultiCheckoutRails,

  getPaymentRail,

  getPaymentRailByMethod,

  invoiceCreationLabelForPaymentMethod,

  isMultiCheckoutRailId,

  multiCheckoutMerchantLabels,

  type MultiCheckoutRailId,

  type PaymentRailId,

  type PaymentRailPlatformFeature,

} from '@/lib/payments/payment-rail-registry';



/** Merchant fields required to evaluate rail setup (matches typical Prisma select). */

export type PaymentLinkMerchantRailSnapshot = {

  stripe_account_id: string | null;

  hedera_account_id: string | null;

  wise_enabled: boolean;

  wise_profile_id: string | null;

  evm_wallet_enabled?: boolean | null;

  evm_wallet_address?: string | null;

  evm_supported_networks?: string[] | null;

  evm_supported_tokens?: string[] | null;

};



export type PaymentRailPlatformFeatures = Partial<

  Record<PaymentRailPlatformFeature, boolean>

>;



export type RailSetupStatus = {

  configured: boolean;

  incomplete: boolean;

};



export type PaymentLinkRailSetupStatus = {

  multiRails: Record<MultiCheckoutRailId, RailSetupStatus>;

  anyRailConfigured: boolean;

  readyForPaymentRequests: boolean;

};



function nonEmpty(value: string | null | undefined): boolean {

  return typeof value === 'string' && value.trim().length > 0;

}



function emptyMultiRailRecord(): Record<MultiCheckoutRailId, RailSetupStatus> {

  return Object.fromEntries(

    getMultiCheckoutRailIds().map((id) => [id, { configured: false, incomplete: false }])

  ) as Record<MultiCheckoutRailId, RailSetupStatus>;

}



function evaluateMultiCheckoutRailReadiness(

  railId: MultiCheckoutRailId,

  merchant: PaymentLinkMerchantRailSnapshot,

  features: PaymentRailPlatformFeatures

): RailSetupStatus {

  const rail = getPaymentRail(railId);



  if (rail.platformFeature && !features[rail.platformFeature]) {

    return { configured: false, incomplete: false };

  }



  switch (railId) {

    case 'stripe':

      return { configured: nonEmpty(merchant.stripe_account_id), incomplete: false };

    case 'hedera':

      return { configured: nonEmpty(merchant.hedera_account_id), incomplete: false };

    case 'wise': {

      const incomplete =

        merchant.wise_enabled === true && !nonEmpty(merchant.wise_profile_id);

      return {

        configured:

          merchant.wise_enabled === true && nonEmpty(merchant.wise_profile_id),

        incomplete,

      };

    }

    case 'evm_wallet': {

      const enabled = merchant.evm_wallet_enabled === true;

      const hasAddress = isEvmWalletAddressConfigured(merchant.evm_wallet_address);

      return {

        configured: enabled && hasAddress,

        incomplete: enabled && !hasAddress,

      };

    }

    default:

      return { configured: false, incomplete: false };

  }

}



export function multiCheckoutRailStatus(

  setup: PaymentLinkRailSetupStatus,

  railId: MultiCheckoutRailId

): RailSetupStatus {

  return setup.multiRails[railId] ?? { configured: false, incomplete: false };

}



export function isMultiCheckoutRailConfigured(

  setup: PaymentLinkRailSetupStatus,

  railId: MultiCheckoutRailId

): boolean {

  return multiCheckoutRailStatus(setup, railId).configured;

}



export function isMultiCheckoutRailIncomplete(

  setup: PaymentLinkRailSetupStatus,

  railId: MultiCheckoutRailId

): boolean {

  return multiCheckoutRailStatus(setup, railId).incomplete;

}



export function computePaymentLinkRailSetup(

  merchant: PaymentLinkMerchantRailSnapshot | null,

  features: PaymentRailPlatformFeatures = {}

): PaymentLinkRailSetupStatus {

  if (!merchant) {

    return {

      multiRails: emptyMultiRailRecord(),

      anyRailConfigured: false,

      readyForPaymentRequests: false,

    };

  }



  const multiRails = emptyMultiRailRecord();

  for (const railId of getMultiCheckoutRailIds()) {

    multiRails[railId] = evaluateMultiCheckoutRailReadiness(railId, merchant, features);

  }



  const anyRailConfigured = getMultiCheckoutRailIds().some(

    (id) => multiRails[id].configured

  );



  return {

    multiRails,

    anyRailConfigured,

    readyForPaymentRequests: anyRailConfigured,

  };

}



export function isPaymentRailConfiguredForMerchant(

  paymentMethod: PaymentMethod,

  setup: PaymentLinkRailSetupStatus

): boolean {

  const rail = getPaymentRailByMethod(paymentMethod);

  if (!rail) return false;



  if (isMultiCheckoutRailId(rail.id)) {

    return isMultiCheckoutRailConfigured(setup, rail.id);

  }



  if (rail.checkoutSurface === 'dedicated') {

    return true;

  }



  return false;

}



export function unavailableReasonForInvoiceRail(

  paymentMethod: PaymentMethod,

  setup: PaymentLinkRailSetupStatus,

  features: PaymentRailPlatformFeatures

): string | undefined {

  const rail = getPaymentRailByMethod(paymentMethod);

  if (!rail) return 'Unavailable';



  if (rail.platformFeature && !features[rail.platformFeature]) {

    return `${rail.merchantSettingsLabel} payments not enabled on this environment`;

  }



  if (!isMultiCheckoutRailId(rail.id)) return undefined;



  const status = multiCheckoutRailStatus(setup, rail.id);

  if (status.incomplete) {

    return rail.unavailableIncompleteReason ?? `${rail.merchantSettingsLabel} setup incomplete`;

  }

  if (!status.configured) {

    return rail.unavailableNotConfiguredReason ?? `${rail.merchantSettingsLabel} not configured`;

  }

  return undefined;

}



export type InvoicePaymentMethodOption = {

  value: PaymentMethod;

  label: string;

  available: boolean;

  unavailableReason?: string;

};



/** Invoice-creation options — labels and availability from the registry. */

export function buildInvoicePaymentMethodOptions(input: {

  setup: PaymentLinkRailSetupStatus;

  features: PaymentRailPlatformFeatures;

}): InvoicePaymentMethodOption[] {

  const multiRails = getMultiCheckoutRails();

  const dedicatedRails = getDedicatedCheckoutRails();



  const multiOptions: InvoicePaymentMethodOption[] = multiRails.map((rail) => {

    const configured = isPaymentRailConfiguredForMerchant(rail.paymentMethod, input.setup);

    const available =

      rail.invoiceAlwaysSelectable === true ||

      (rail.platformFeature

        ? Boolean(input.features[rail.platformFeature]) && configured

        : configured);

    const unavailableReason = available

      ? undefined

      : unavailableReasonForInvoiceRail(rail.paymentMethod, input.setup, input.features);

    return {

      value: rail.paymentMethod,

      label: invoiceCreationLabelForPaymentMethod(rail.paymentMethod),

      available,

      unavailableReason,

    };

  });



  const dedicatedOptions: InvoicePaymentMethodOption[] = dedicatedRails.map((rail) => ({

    value: rail.paymentMethod,

    label: invoiceCreationLabelForPaymentMethod(rail.paymentMethod),

    available: true,

  }));



  return [...multiOptions, ...dedicatedOptions];

}



export function pickAlternativePaymentMethod(

  setup: PaymentLinkRailSetupStatus,

  current: PaymentMethod

): PaymentMethod | null {

  for (const rail of getMultiCheckoutRails()) {

    if (rail.paymentMethod === current) continue;

    if (isPaymentRailConfiguredForMerchant(rail.paymentMethod, setup)) {

      return rail.paymentMethod;

    }

  }

  return null;

}



/** Multi-checkout rails that can block invoice creation when unconfigured. */

export type PaymentLinksGuardrailKind = 'no_rails' | MultiCheckoutRailId;



export function guardrailKindForUnconfiguredPaymentMethod(

  paymentMethod: PaymentMethod,

  setup: PaymentLinkRailSetupStatus

): PaymentLinksGuardrailKind | null {

  const rail = getPaymentRailByMethod(paymentMethod);

  if (!rail || rail.checkoutSurface !== 'multi') return null;

  if (isPaymentRailConfiguredForMerchant(paymentMethod, setup)) return null;

  return rail.id as PaymentLinksGuardrailKind;

}



export function multiCheckoutRailLabelsForGuardrail(): string {

  return multiCheckoutMerchantLabels();

}



/** Maps camelCase merchant settings (API / Create Invoice dialog) to rail snapshot. */

export function toPaymentLinkRailSnapshot(

  merchant:

    | {

        stripeAccountId?: string | null;

        hederaAccountId?: string | null;

        evmWalletEnabled?: boolean | null;

        evmWalletAddress?: string | null;

        evmSupportedNetworks?: string[] | null;

        evmSupportedTokens?: string[] | null;

        wiseEnabled?: boolean;

        wiseProfileId?: string | null;

      }

    | null

    | undefined

): PaymentLinkMerchantRailSnapshot | null {

  if (!merchant) return null;

  return {

    stripe_account_id: merchant.stripeAccountId ?? null,

    hedera_account_id: merchant.hederaAccountId ?? null,

    evm_wallet_enabled: merchant.evmWalletEnabled === true,

    evm_wallet_address: merchant.evmWalletAddress ?? null,

    evm_supported_networks: merchant.evmSupportedNetworks ?? null,

    evm_supported_tokens: merchant.evmSupportedTokens ?? null,

    wise_enabled: merchant.wiseEnabled === true,

    wise_profile_id: merchant.wiseProfileId ?? null,

  };

}


