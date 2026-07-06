/**
 * Canonical Payment Rail Registry
 *
 * Single source of truth for payment rail identity across:
 * - Prisma PaymentMethod enum
 * - Public checkout UI keys (e.g. metamask → EVM_WALLET)
 * - confirmPayment() settlement providers
 * - Customer-facing labels
 * - Multi-rail vs dedicated-invoice checkout surfaces
 *
 * Rail-specific behavior (Wise API, MetaMask viem, Stripe Checkout) stays in
 * adapter modules — this registry holds metadata and access rules only.
 */

import type { PaymentMethod } from '@prisma/client';
import type { ReferralPaymentRail } from '@/lib/referrals/referral-payment-rails';

/** Internal registry ids — stable snake_case keys. */
export type PaymentRailId =
  | 'stripe'
  | 'hedera'
  | 'wise'
  | 'evm_wallet'
  | 'crypto'
  | 'manual_bank';

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

export interface PaymentRailDefinition {
  id: PaymentRailId;
  paymentMethod: PaymentMethod;
  publicCheckoutKey: PublicCheckoutMethodKey;
  settlementProvider: SettlementProvider | null;
  displayLabel: string;
  checkoutSurface: PaymentRailCheckoutSurface;
  /** When set, referral checkout can filter this rail via referral-payment-rails. */
  referralRailKey?: ReferralPaymentRail;
}

export const PAYMENT_RAIL_REGISTRY: readonly PaymentRailDefinition[] = [
  {
    id: 'stripe',
    paymentMethod: 'STRIPE',
    publicCheckoutKey: 'stripe',
    settlementProvider: 'stripe',
    displayLabel: 'Card',
    checkoutSurface: 'multi',
    referralRailKey: 'stripe',
  },
  {
    id: 'hedera',
    paymentMethod: 'HEDERA',
    publicCheckoutKey: 'hedera',
    settlementProvider: 'hedera',
    displayLabel: 'HashPack',
    checkoutSurface: 'multi',
    referralRailKey: 'hedera',
  },
  {
    id: 'wise',
    paymentMethod: 'WISE',
    publicCheckoutKey: 'wise',
    settlementProvider: 'wise',
    displayLabel: 'Wise',
    checkoutSurface: 'multi',
    referralRailKey: 'wise',
  },
  {
    id: 'evm_wallet',
    paymentMethod: 'EVM_WALLET',
    publicCheckoutKey: 'metamask',
    settlementProvider: 'evm_wallet',
    displayLabel: 'MetaMask',
    checkoutSurface: 'multi',
  },
  {
    id: 'crypto',
    paymentMethod: 'CRYPTO',
    publicCheckoutKey: 'crypto',
    settlementProvider: 'manual',
    displayLabel: 'Manual Crypto',
    checkoutSurface: 'dedicated',
  },
  {
    id: 'manual_bank',
    paymentMethod: 'MANUAL_BANK',
    publicCheckoutKey: 'manualBank',
    settlementProvider: 'manual',
    displayLabel: 'Manual Bank',
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

/** Checkout rails exposed alongside each other on a multi-method invoice. */
export type MultiCheckoutRail = Extract<
  PaymentMethod,
  'STRIPE' | 'HEDERA' | 'WISE' | 'EVM_WALLET'
>;

/** Dedicated manual-instruction invoice types. */
export type DedicatedCheckoutRail = Extract<PaymentMethod, 'CRYPTO' | 'MANUAL_BANK'>;

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
