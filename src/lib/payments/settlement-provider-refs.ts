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

/** Pre–deal-scoped hackathon demo funding key (legacy global idempotency slot). */
export const LEGACY_HACKATHON_DEMO_FUNDING_SOURCE_REFERENCE =
  'Hackathon demo · simulated Stage 5 collection';

export function hackathonDemoFundingSourceReference(dealId: string): string {
  return `hackathon-demo:funding:${dealId}`;
}

export function isHackathonDemoFundingSourceReference(
  sourceReference: string,
  dealId: string,
): boolean {
  return sourceReference === hackathonDemoFundingSourceReference(dealId);
}
