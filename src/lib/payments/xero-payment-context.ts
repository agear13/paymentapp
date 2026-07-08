/**
 * Xero payment context — enriched metadata for future accounting visibility.
 * Does not change Xero API calls; prepares the context model only.
 */

import type { PaymentTransactionLayers } from '@/lib/payments/payment-layers';

export type XeroPaymentContextMetadata = {
  originalInvoiceCurrency: string;
  originalInvoiceAmount: string;
  commercialCurrency: string;
  commercialAmount: string;
  commercialInvoiceReference?: string | null;
  originalInvoiceDate?: string | null;
  settlementCurrency: string | null;
  settlementAmount: string | null;
  settlementTimestamp?: string | null;
  confirmations?: number | null;
  accountingCurrency: string;
  accountingAmount: string;
  fxRate: number | null;
  fxProvider: string | null;
  fxCapturedAt: string | null;
  fxSnapshotId?: string | null;
  valuationMethod: string | null;
  transactionHash: string | null;
  wallet: string | null;
  walletMasked?: string | null;
  network: string | null;
  paymentRail: string | null;
  token: string | null;
  provvypayPaymentLinkId?: string | null;
};

export function buildXeroPaymentContextMetadata(
  layers: PaymentTransactionLayers
): XeroPaymentContextMetadata {
  return {
    originalInvoiceCurrency: layers.commercial.currency,
    originalInvoiceAmount: layers.commercial.amount,
    commercialCurrency: layers.commercial.currency,
    commercialAmount: layers.commercial.amount,
    settlementCurrency: layers.settlement?.currency ?? null,
    settlementAmount: layers.settlement?.amount ?? null,
    accountingCurrency: layers.accounting?.currency ?? layers.commercial.currency,
    accountingAmount: layers.accounting?.amount ?? layers.commercial.amount,
    fxRate: layers.fxSnapshot?.exchangeRate ?? layers.accounting?.exchangeRate ?? null,
    fxProvider: layers.fxSnapshot?.provider ?? null,
    fxCapturedAt:
      layers.fxSnapshot?.capturedAt?.toISOString() ??
      layers.accounting?.capturedAt?.toISOString() ??
      null,
    valuationMethod:
      layers.fxSnapshot?.valuationMethod ?? layers.accounting?.valuationMethod ?? null,
    transactionHash: layers.settlement?.transactionHash ?? null,
    wallet: layers.settlement?.wallet ?? null,
    network: layers.settlement?.network ?? null,
    paymentRail: layers.settlement?.paymentRail ?? null,
    token: layers.settlement?.token ?? null,
  };
}

/** Shape for Xero invoice/payment request_payload enrichment (future use). */
export function enrichXeroRequestPayload(
  existing: Record<string, unknown> | null | undefined,
  layers: PaymentTransactionLayers
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    paymentLayers: buildXeroPaymentContextMetadata(layers),
    /** Xero posting should use accounting layer — not settlement. */
    xeroPostingCurrency: layers.accounting?.currency ?? layers.commercial.currency,
    xeroPostingAmount: layers.accounting?.amount ?? layers.commercial.amount,
  };
}
