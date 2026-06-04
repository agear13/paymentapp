/**
 * Temporary production trace for commission propagation (remove after root-cause is fixed).
 * Enable on Render: COMMISSION_PROPAGATION_TRACE=true
 *
 * Logs are prefixed [COMMISSION_PROPAGATION_TRACE] for Render log search.
 */

import { log } from '@/lib/logger';

export type CommissionPropagationStage =
  | 'payment_confirmed_committed'
  | 'commission_block_skipped_idempotent'
  | 'commission_metadata_resolved'
  | 'commission_apply_enter'
  | 'commission_skipped_no_metadata'
  | 'commission_skipped_below_minimum'
  | 'commission_skipped_ledger_provision'
  | 'commission_skipped_ledger_post'
  | 'commission_obligation_created'
  | 'commission_obligation_exists_idempotent'
  | 'commission_obligation_create_failed'
  | 'commission_items_created'
  | 'commission_apply_complete'
  | 'funding_orchestration_skipped_no_pilot_deal'
  | 'funding_orchestration_started'
  | 'participant_dashboard_query';

export function isCommissionPropagationTraceEnabled(): boolean {
  return process.env.COMMISSION_PROPAGATION_TRACE === 'true';
}

export function commissionPropagationTrace(
  stage: CommissionPropagationStage,
  payload: Record<string, unknown>
): void {
  if (!isCommissionPropagationTraceEnabled()) return;
  log.info('[COMMISSION_PROPAGATION_TRACE]', {
    stage,
    at: new Date().toISOString(),
    ...payload,
  });
}
