export function payoutIdempotencyKey(organizationId: string, payoutId: string): string {
  return `payout:${organizationId}:${payoutId}`;
}
