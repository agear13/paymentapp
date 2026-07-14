/**
 * Wise auto-settlement requires webhook correlation via wise_transfer_id on payment links.
 * Pilot week 1 uses Stripe; keep auto-matching hidden until explicitly enabled.
 */
export function isWiseAutoSettlementAvailable(
  processEnv: NodeJS.ProcessEnv = process.env
): boolean {
  const wisePayments =
    ['true', '1'].includes((processEnv.ENABLE_WISE_PAYMENTS || '').toLowerCase()) &&
    !!processEnv.WISE_API_TOKEN?.trim();
  if (!wisePayments) return false;
  if (!processEnv.WISE_WEBHOOK_SECRET?.trim()) return false;
  return processEnv.WISE_AUTO_SETTLEMENT_ENABLED === 'true';
}
