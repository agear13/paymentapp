/**
 * Stable providerRef formats for canonical settlement idempotency.
 * Runtime-safe (no server-only) — usable from scripts and server modules.
 */

export function bankReviewProviderRef(confirmationId: string): string {
  return `bank-review:${confirmationId}`;
}

export function cryptoReviewProviderRef(confirmationId: string): string {
  return `crypto-review:${confirmationId}`;
}

export function manualSettlementProviderRef(paymentLinkId: string): string {
  return `manual-settlement:${paymentLinkId}`;
}
