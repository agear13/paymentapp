/**

 * Canonical Payment Rail Registry

 *

 * Single source of truth for payment rail identity across:

 * - Prisma PaymentMethod enum

 * - Public checkout UI keys (e.g. metamask → EVM_WALLET)

 * - confirmPayment() settlement providers

 * - Merchant configuration, invoice creation, and customer-facing labels

 * - Multi-rail vs dedicated-invoice checkout surfaces

 *

 * Rail-specific behavior (Wise API, MetaMask viem, Stripe Checkout) stays in

 * adapter modules — this registry holds metadata and access rules only.

 */



import type { PaymentMethod } from '@prisma/client';

import { EVM_NETWORKS, type EvmNetworkId } from '@/lib/evm/networks';

import { EVM_SETTLEMENT_TOKENS, type EvmSettlementToken } from '@/lib/evm/tokens';

import type { ReferralPaymentRail } from '@/lib/referrals/referral-payment-rails';



/** Internal registry ids — stable snake_case keys. */

export type PaymentRailId =

  | 'stripe'

  | 'hedera'

  | 'wise'

  | 'evm_wallet'

  | 'crypto'

  | 'manual_bank';



/** Multi-checkout rails (collection & settlement / integrations cards). */

export type MultiCheckoutRailId = Extract<

  PaymentRailId,

  'stripe' | 'hedera' | 'wise' | 'evm_wallet'

>;



/** confirmPayment() provider strings for automated settlement rails. */

export type SettlementProvider = 'stripe' | 'hedera' | 'wise' | 'evm_wallet' | 'manual';



/** Keys on the public pay page `availablePaymentMethods` payload. */

export type PublicCheckoutMethodKey =

  | 'stripe'

  | 'hedera'

  | 'wise'

  | 'metamask'

  | 'crypto'

  | 'manualBank';



export type PaymentRailCheckoutSurface = 'multi' | 'dedicated';



/** Platform feature flags that gate merchant-configurable rails. */

export type PaymentRailPlatformFeature = 'wisePayments' | 'evmWalletPayments';



export interface PaymentRailDefinition {

  id: PaymentRailId;

  paymentMethod: PaymentMethod;

  publicCheckoutKey: PublicCheckoutMethodKey;

  settlementProvider: SettlementProvider | null;

  /** Public pay-page checkout option label (wallet adapter where applicable). */

  displayLabel: string;

  /** Collection & settlement settings section title. */

  merchantSettingsLabel: string;

  /** Invoice creation payment-method picker label. */

  invoiceCreationLabel: string;

  /** Integrations page card icon (display emoji). */

  integrationsIcon: string;

  /** Integrations page card description. */

  integrationsDescription: string;

  checkoutSurface: PaymentRailCheckoutSurface;

  /** When true, invoice picker stays selectable before merchant config (guardrails block submit). */

  invoiceAlwaysSelectable?: boolean;

  /** Copilot / setup checklist copy when the rail is fully configured. */

  merchantSetupCompleteDescription?: string;

  /** Copilot / setup checklist copy when the rail is not configured. */

  merchantSetupIncompleteDescription?: string;

  /** Copilot / setup checklist copy when enabled but missing required credentials. */

  merchantSetupAttentionDescription?: string;

  /** Invoice picker unavailable reason when incomplete (enabled but missing fields). */

  unavailableIncompleteReason?: string;

  /** Invoice picker unavailable reason when not configured. */

  unavailableNotConfiguredReason?: string;

  /** When set, referral checkout can filter this rail via referral-payment-rails. */

  referralRailKey?: ReferralPaymentRail;

  /** Global env feature required for merchant to enable this rail (optional). */

  platformFeature?: PaymentRailPlatformFeature;

}



/** Default EVM networks/tokens merchants may offer — sourced from EVM adapter modules. */

export const EVM_RAIL_DEFAULT_NETWORKS: readonly EvmNetworkId[] = Object.keys(

  EVM_NETWORKS

) as EvmNetworkId[];



export const EVM_RAIL_DEFAULT_TOKENS: readonly EvmSettlementToken[] = EVM_SETTLEMENT_TOKENS;



export function evmNetworkDisplayName(networkId: string): string {

  const config = EVM_NETWORKS[networkId as EvmNetworkId];

  return config?.name ?? networkId;

}



export const PAYMENT_RAIL_REGISTRY: readonly PaymentRailDefinition[] = [

  {

    id: 'stripe',

    paymentMethod: 'STRIPE',

    publicCheckoutKey: 'stripe',

    settlementProvider: 'stripe',

    displayLabel: 'Card',

    merchantSettingsLabel: 'Stripe',

    invoiceCreationLabel: 'Credit / Debit card (Stripe)',

    integrationsIcon: '💳',

    integrationsDescription: 'Card and fiat payments.',

    checkoutSurface: 'multi',

    invoiceAlwaysSelectable: true,

    merchantSetupCompleteDescription:

      'Stripe Connect is linked for card and wallet checkouts.',

    merchantSetupIncompleteDescription:

      'Connect Stripe to accept card payments through Payment Links.',

    unavailableNotConfiguredReason: 'Stripe not configured',

    referralRailKey: 'stripe',

  },

  {

    id: 'hedera',

    paymentMethod: 'HEDERA',

    publicCheckoutKey: 'hedera',

    settlementProvider: 'hedera',

    displayLabel: 'HashPack',

    merchantSettingsLabel: 'Hedera',

    invoiceCreationLabel: 'Crypto (Hashpack, auto-verified on Hedera)',

    integrationsIcon: '₿',

    integrationsDescription: 'Cryptocurrency payments on Hedera.',

    checkoutSurface: 'multi',

    invoiceAlwaysSelectable: true,

    merchantSetupCompleteDescription:

      'A Hedera account is configured for on-ledger settlement options.',

    merchantSetupIncompleteDescription:

      'Optionally add a Hedera account ID for supported token flows.',

    unavailableNotConfiguredReason: 'Hedera wallet not configured',

    referralRailKey: 'hedera',

  },

  {

    id: 'wise',

    paymentMethod: 'WISE',

    publicCheckoutKey: 'wise',

    settlementProvider: 'wise',

    displayLabel: 'Wise',

    merchantSettingsLabel: 'Wise',

    invoiceCreationLabel: 'Bank transfer (Wise)',

    integrationsIcon: '🏦',

    integrationsDescription: 'Bank transfer via Wise.',

    checkoutSurface: 'multi',

    merchantSetupCompleteDescription: 'Wise is enabled and a profile is on file.',

    merchantSetupIncompleteDescription:

      'Enable Wise and attach a Wise profile to offer bank-friendly payouts where supported.',

    merchantSetupAttentionDescription:

      'Wise is toggled on but no profile ID is set. Finish Wise setup in merchant settings.',

    unavailableIncompleteReason: 'Wise Profile ID not configured',

    unavailableNotConfiguredReason: 'Wise not fully configured',

    referralRailKey: 'wise',

    platformFeature: 'wisePayments',

  },

  {

    id: 'evm_wallet',

    paymentMethod: 'EVM_WALLET',

    publicCheckoutKey: 'metamask',

    settlementProvider: 'evm_wallet',

    displayLabel: 'MetaMask',

    merchantSettingsLabel: 'EVM Wallet',

    invoiceCreationLabel: 'Crypto (MetaMask & EVM Wallets)',

    integrationsIcon: '⟠',

    integrationsDescription: 'Automated USDC/USDT payments on EVM networks.',

    checkoutSurface: 'multi',

    merchantSetupCompleteDescription:

      'EVM Wallet is enabled with a receive address and supported networks/tokens.',

    merchantSetupIncompleteDescription:

      'Enable EVM Wallet and add a receive address to accept USDC/USDT on supported networks.',

    merchantSetupAttentionDescription:

      'EVM Wallet is enabled but no receive wallet is set. Add your wallet in collection & settlement setup.',

    unavailableIncompleteReason: 'EVM receive wallet not configured',

    unavailableNotConfiguredReason: 'EVM Wallet not fully configured',

    platformFeature: 'evmWalletPayments',

  },

  {

    id: 'crypto',

    paymentMethod: 'CRYPTO',

    publicCheckoutKey: 'crypto',

    settlementProvider: 'manual',

    displayLabel: 'Manual Crypto',

    merchantSettingsLabel: 'Manual Crypto',

    invoiceCreationLabel: 'Crypto (manual wallet instructions)',

    integrationsIcon: '🔗',

    integrationsDescription: 'Manual crypto payment instructions on invoices.',

    checkoutSurface: 'dedicated',

  },

  {

    id: 'manual_bank',

    paymentMethod: 'MANUAL_BANK',

    publicCheckoutKey: 'manualBank',

    settlementProvider: 'manual',

    displayLabel: 'Manual Bank',

    merchantSettingsLabel: 'Manual Bank',

    invoiceCreationLabel: 'Manual bank transfer (bank / Wise / Revolut / other)',

    integrationsIcon: '🏛️',

    integrationsDescription: 'Manual bank transfer instructions on invoices.',

    checkoutSurface: 'dedicated',

    referralRailKey: 'manual',

  },

] as const;



const registryById = new Map(PAYMENT_RAIL_REGISTRY.map((rail) => [rail.id, rail]));

const registryByMethod = new Map(

  PAYMENT_RAIL_REGISTRY.map((rail) => [rail.paymentMethod, rail])

);

const registryByPublicKey = new Map(

  PAYMENT_RAIL_REGISTRY.map((rail) => [rail.publicCheckoutKey, rail])

);



export function getPaymentRail(id: PaymentRailId): PaymentRailDefinition {

  const rail = registryById.get(id);

  if (!rail) {

    throw new Error(`Unknown payment rail: ${id}`);

  }

  return rail;

}



export function getPaymentRailByMethod(

  paymentMethod: PaymentMethod

): PaymentRailDefinition | undefined {

  return registryByMethod.get(paymentMethod);

}



export function getPaymentRailByPublicCheckoutKey(

  key: PublicCheckoutMethodKey

): PaymentRailDefinition {

  const rail = registryByPublicKey.get(key);

  if (!rail) {

    throw new Error(`Unknown public checkout key: ${key}`);

  }

  return rail;

}



export function getPaymentRailsBySurface(

  surface: PaymentRailCheckoutSurface

): PaymentRailDefinition[] {

  return PAYMENT_RAIL_REGISTRY.filter((rail) => rail.checkoutSurface === surface);

}



/** Payment methods selectable when creating a payment-request invoice. */

export function getInvoiceSelectablePaymentMethods(): PaymentMethod[] {

  return PAYMENT_RAIL_REGISTRY.map((rail) => rail.paymentMethod);

}



/** Checkout rails exposed alongside each other on a multi-method invoice. */

export type MultiCheckoutRail = Extract<

  PaymentMethod,

  'STRIPE' | 'HEDERA' | 'WISE' | 'EVM_WALLET'

>;



/** Dedicated manual-instruction invoice types. */

export type DedicatedCheckoutRail = Extract<PaymentMethod, 'CRYPTO' | 'MANUAL_BANK'>;



export function getMultiCheckoutRails(): PaymentRailDefinition[] {

  return getPaymentRailsBySurface('multi');

}



export function getMultiCheckoutRailIds(): MultiCheckoutRailId[] {

  return getMultiCheckoutRails().map((rail) => rail.id as MultiCheckoutRailId);

}



export function isMultiCheckoutRailId(id: PaymentRailId): id is MultiCheckoutRailId {

  return getMultiCheckoutRails().some((rail) => rail.id === id);

}



export function getDedicatedCheckoutRails(): PaymentRailDefinition[] {

  return getPaymentRailsBySurface('dedicated');

}



/**

 * Whether a payment link accepts checkout on the given rail.

 * Multi-rail: unlocked or locked to this rail.

 * Dedicated-rail: locked exclusively to this rail.

 */

export function paymentLinkAllowsCheckoutRail(

  lockedMethod: PaymentMethod | null | undefined,

  rail: PaymentRailDefinition | PaymentMethod

): boolean {

  const definition =

    typeof rail === 'string' ? getPaymentRailByMethod(rail) : rail;

  if (!definition) return false;



  if (definition.checkoutSurface === 'multi') {

    return !lockedMethod || lockedMethod === definition.paymentMethod;

  }

  return lockedMethod === definition.paymentMethod;

}



export const PUBLIC_CHECKOUT_METHOD_LABELS = Object.fromEntries(

  PAYMENT_RAIL_REGISTRY.map((rail) => [rail.publicCheckoutKey, rail.displayLabel])

) as Record<PublicCheckoutMethodKey, string>;



export const PUBLIC_CHECKOUT_TO_PAYMENT_METHOD = Object.fromEntries(

  PAYMENT_RAIL_REGISTRY.map((rail) => [rail.publicCheckoutKey, rail.paymentMethod])

) as Record<PublicCheckoutMethodKey, PaymentMethod>;



export function publicCheckoutLabelForPaymentMethod(

  method: PaymentMethod | null | undefined

): string | null {

  if (!method) return null;

  return getPaymentRailByMethod(method)?.displayLabel ?? null;

}



export function settlementProviderForPaymentMethod(

  method: PaymentMethod

): SettlementProvider | null {

  return getPaymentRailByMethod(method)?.settlementProvider ?? null;

}



export function invoiceCreationLabelForPaymentMethod(

  method: PaymentMethod

): string {

  return getPaymentRailByMethod(method)?.invoiceCreationLabel ?? method;

}



export function merchantSettingsLabelForPaymentMethod(

  method: PaymentMethod

): string {

  return getPaymentRailByMethod(method)?.merchantSettingsLabel ?? method;

}



export function multiCheckoutMerchantLabels(): string {

  return getMultiCheckoutRails()

    .map((rail) => rail.merchantSettingsLabel)

    .join(', ');

}


