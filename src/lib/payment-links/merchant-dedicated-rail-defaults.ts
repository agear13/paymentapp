/**
 * Merchant-level defaults for dedicated checkout rails (Manual Bank, Manual Crypto).
 *
 * These values are persisted on prior payment links for the organization — the same
 * fields merchants configure once in Payment Settings / legacy invoice creation.
 * Commercial OS reuses them when creating new invoices (no per-invoice re-entry).
 */

import { fetchAllPaymentLinks } from '@/lib/payment-links/fetch-payment-links-list.client';

export type ManualBankRailDefaults = {
  manualBankRecipientName: string;
  manualBankCurrency: string;
  manualBankDestinationType: string;
  manualBankBankName?: string | null;
  manualBankAccountNumber?: string | null;
  manualBankIban?: string | null;
  manualBankSwiftBic?: string | null;
  manualBankRoutingSortCode?: string | null;
  manualBankWiseReference?: string | null;
  manualBankRevolutHandle?: string | null;
  manualBankInstructions?: string | null;
};

export type CryptoRailDefaults = {
  cryptoNetwork: string;
  cryptoAddress: string;
  cryptoCurrency: string;
  cryptoMemo?: string | null;
  cryptoInstructions?: string | null;
};

export type MerchantDedicatedRailDefaults = {
  manualBank: ManualBankRailDefaults | null;
  crypto: CryptoRailDefaults | null;
};

type PaymentLinkLike = {
  paymentMethod?: string | null;
  manualBankRecipientName?: string | null;
  manualBankCurrency?: string | null;
  manualBankDestinationType?: string | null;
  manualBankBankName?: string | null;
  manualBankAccountNumber?: string | null;
  manualBankIban?: string | null;
  manualBankSwiftBic?: string | null;
  manualBankRoutingSortCode?: string | null;
  manualBankWiseReference?: string | null;
  manualBankRevolutHandle?: string | null;
  manualBankInstructions?: string | null;
  cryptoNetwork?: string | null;
  cryptoAddress?: string | null;
  cryptoCurrency?: string | null;
  cryptoMemo?: string | null;
  cryptoInstructions?: string | null;
  createdAt?: string | Date | null;
};

export const PAYMENT_SETTINGS_PATH = '/dashboard/settings/merchant';

export function isManualBankDefaultsComplete(
  link: Pick<
    PaymentLinkLike,
    'manualBankRecipientName' | 'manualBankCurrency' | 'manualBankDestinationType'
  >
): boolean {
  return Boolean(
    link.manualBankRecipientName?.trim() &&
      link.manualBankCurrency?.trim() &&
      link.manualBankDestinationType?.trim()
  );
}

export function isCryptoDefaultsComplete(
  link: Pick<PaymentLinkLike, 'cryptoNetwork' | 'cryptoAddress' | 'cryptoCurrency'>
): boolean {
  return Boolean(
    link.cryptoNetwork?.trim() && link.cryptoAddress?.trim() && link.cryptoCurrency?.trim()
  );
}

export function extractManualBankDefaults(link: PaymentLinkLike): ManualBankRailDefaults | null {
  if (!isManualBankDefaultsComplete(link)) return null;
  return {
    manualBankRecipientName: link.manualBankRecipientName!.trim(),
    manualBankCurrency: link.manualBankCurrency!.trim(),
    manualBankDestinationType: link.manualBankDestinationType!.trim(),
    manualBankBankName: link.manualBankBankName?.trim() || null,
    manualBankAccountNumber: link.manualBankAccountNumber?.trim() || null,
    manualBankIban: link.manualBankIban?.trim() || null,
    manualBankSwiftBic: link.manualBankSwiftBic?.trim() || null,
    manualBankRoutingSortCode: link.manualBankRoutingSortCode?.trim() || null,
    manualBankWiseReference: link.manualBankWiseReference?.trim() || null,
    manualBankRevolutHandle: link.manualBankRevolutHandle?.trim() || null,
    manualBankInstructions: link.manualBankInstructions?.trim() || null,
  };
}

export function extractCryptoDefaults(link: PaymentLinkLike): CryptoRailDefaults | null {
  if (!isCryptoDefaultsComplete(link)) return null;
  return {
    cryptoNetwork: link.cryptoNetwork!.trim(),
    cryptoAddress: link.cryptoAddress!.trim(),
    cryptoCurrency: link.cryptoCurrency!.trim(),
    cryptoMemo: link.cryptoMemo?.trim() || null,
    cryptoInstructions: link.cryptoInstructions?.trim() || null,
  };
}

/** Pick the newest payment link (by createdAt) that has complete defaults for a rail. */
export function resolveDedicatedRailDefaultsFromLinks(
  links: PaymentLinkLike[]
): MerchantDedicatedRailDefaults {
  const sorted = [...links].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  let manualBank: ManualBankRailDefaults | null = null;
  let crypto: CryptoRailDefaults | null = null;

  for (const link of sorted) {
    const method = link.paymentMethod?.toUpperCase();
    if (!manualBank && method === 'MANUAL_BANK') {
      manualBank = extractManualBankDefaults(link);
    }
    if (!crypto && method === 'CRYPTO') {
      crypto = extractCryptoDefaults(link);
    }
    if (manualBank && crypto) break;
  }

  return { manualBank, crypto };
}

export async function fetchMerchantDedicatedRailDefaults(
  organizationId: string
): Promise<MerchantDedicatedRailDefaults> {
  const links = await fetchAllPaymentLinks<PaymentLinkLike>({ organizationId });
  return resolveDedicatedRailDefaultsFromLinks(links);
}

export const MANUAL_BANK_UNAVAILABLE_REASON =
  "Manual Bank Transfer isn't ready yet. Add your business bank account in Payment Settings to enable this payment method.";

export const CRYPTO_UNAVAILABLE_REASON =
  "Crypto payments aren't ready yet. Add your wallet in Payment Settings to enable this payment method.";
