/**
 * Temporary structured trace for referral issuance visibility debugging.
 * Enable: REFERRAL_ISSUANCE_DEBUG=1
 */

import { log } from '@/lib/logger';

export function isReferralTraceEnabled(): boolean {
  return process.env.REFERRAL_ISSUANCE_DEBUG === '1';
}

export function referralTrace(phase: string, payload: Record<string, unknown>): void {
  if (!isReferralTraceEnabled()) return;
  log.info(`[referral-trace] ${phase}`, {
    referralTrace: true,
    phase,
    at: new Date().toISOString(),
    ...payload,
  });
}
