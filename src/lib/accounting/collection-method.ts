/**
 * Collection methods — how the customer paid within a payment rail.
 * Distinct from payment rail (e.g. Crypto) and payment asset (e.g. USDC).
 */

export type CollectionMethod =
  | 'manual_wallet'
  | 'hashpack'
  | 'metamask'
  | 'wallet_connect'
  | string;

export function normalizeCollectionMethod(
  method: CollectionMethod | string | null | undefined
): CollectionMethod | null {
  const value = method?.trim().toLowerCase();
  return value ? value : null;
}

export function collectionMethodFromPaymentMethod(
  paymentMethod: string | null | undefined
): CollectionMethod | null {
  switch (paymentMethod) {
    case 'HEDERA':
      return 'hashpack';
    case 'EVM_WALLET':
      return 'metamask';
    case 'CRYPTO':
      return 'manual_wallet';
    default:
      return null;
  }
}
