/**
 * Shared payment-link rail access rules for public checkout.
 * Mirrors conventions used by Stripe, Wise, HashPack, and MetaMask flows.
 */

import type { PaymentMethod } from '@prisma/client';

/** Checkout rails exposed alongside each other on a multi-method invoice. */
export type MultiCheckoutRail = Extract<
  PaymentMethod,
  'STRIPE' | 'HEDERA' | 'WISE' | 'EVM_WALLET'
>;

/** Dedicated manual-instruction invoice types. */
export type DedicatedCheckoutRail = Extract<PaymentMethod, 'CRYPTO' | 'MANUAL_BANK'>;

/**
 * True when the link accepts a given multi-rail checkout option.
 * Null `lockedMethod` means all configured rails are allowed.
 */
export function paymentLinkAllowsMultiCheckoutRail(
  lockedMethod: PaymentMethod | null | undefined,
  rail: MultiCheckoutRail
): boolean {
  return !lockedMethod || lockedMethod === rail;
}

/** True when the invoice is locked to a dedicated manual rail (CRYPTO / MANUAL_BANK). */
export function paymentLinkIsDedicatedRail(
  lockedMethod: PaymentMethod | null | undefined,
  rail: DedicatedCheckoutRail
): boolean {
  return lockedMethod === rail;
}
