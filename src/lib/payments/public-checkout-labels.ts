/**
 * Customer-facing labels for public checkout methods.
 * Internal payment_method / provider values stay on the rail enums.
 */

import type { PaymentMethod } from '@prisma/client';

/** Keys used by the public pay page `availablePaymentMethods` payload. */
export type PublicCheckoutMethodKey =
  | 'stripe'
  | 'hedera'
  | 'wise'
  | 'metamask'
  | 'crypto'
  | 'manualBank';

export const PUBLIC_CHECKOUT_METHOD_LABELS: Record<PublicCheckoutMethodKey, string> = {
  stripe: 'Card',
  hedera: 'HashPack',
  wise: 'Wise',
  metamask: 'MetaMask',
  crypto: 'Manual Crypto',
  manualBank: 'Manual Bank',
};

/** Maps public UI keys to canonical PaymentMethod enum values. */
export const PUBLIC_CHECKOUT_TO_PAYMENT_METHOD: Partial<
  Record<PublicCheckoutMethodKey, PaymentMethod>
> = {
  stripe: 'STRIPE',
  hedera: 'HEDERA',
  wise: 'WISE',
  metamask: 'EVM_WALLET',
  crypto: 'CRYPTO',
  manualBank: 'MANUAL_BANK',
};

export function publicCheckoutLabelForPaymentMethod(
  method: PaymentMethod | null | undefined
): string | null {
  if (!method) return null;
  switch (method) {
    case 'STRIPE':
      return PUBLIC_CHECKOUT_METHOD_LABELS.stripe;
    case 'HEDERA':
      return PUBLIC_CHECKOUT_METHOD_LABELS.hedera;
    case 'WISE':
      return PUBLIC_CHECKOUT_METHOD_LABELS.wise;
    case 'EVM_WALLET':
      return PUBLIC_CHECKOUT_METHOD_LABELS.metamask;
    case 'CRYPTO':
      return PUBLIC_CHECKOUT_METHOD_LABELS.crypto;
    case 'MANUAL_BANK':
      return PUBLIC_CHECKOUT_METHOD_LABELS.manualBank;
    default:
      return null;
  }
}
