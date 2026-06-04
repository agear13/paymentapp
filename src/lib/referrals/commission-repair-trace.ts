import { log } from '@/lib/logger';

export type CommissionRepairStage =
  | 'commission_repair_started'
  | 'commission_repair_completed'
  | 'commission_repair_skipped'
  | 'commission_repair_failed';

export function commissionRepairTrace(
  stage: CommissionRepairStage,
  payload: Record<string, unknown>
): void {
  log.info(`[${stage}]`, {
    stage,
    at: new Date().toISOString(),
    ...payload,
  });
}
