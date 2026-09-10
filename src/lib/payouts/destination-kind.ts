import type { PayoutMethodType } from '@prisma/client';
import type { PayoutDestinationKind } from '@/lib/payouts/rails/types';

/** Map existing payout method types onto canonical destination kinds. */
export function destinationKindFromPayoutMethodType(
  methodType: PayoutMethodType | string | null | undefined
): PayoutDestinationKind | null {
  switch (methodType) {
    case 'BANK_TRANSFER':
    case 'WISE':
      return 'BANK_ACCOUNT';
    case 'CRYPTO':
    case 'HEDERA':
      return 'WALLET';
    case 'PAYPAL':
    case 'MANUAL_NOTE':
      return 'PLATFORM_HANDLE';
    default:
      return null;
  }
}
