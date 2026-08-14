/**
 * Wise auto-settlement requires webhook secret + explicit platform flag.
 * Incoming pay-ins are correlated via PROVVY-{shortCode} from:
 *   - account-details-payment#state-change + Balance Statement paymentReference
 *   - swift-in#credit data.resource.reference
 * balances#update is ignored for reference correlation (transfer_reference is Wise-internal).
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
