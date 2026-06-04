import { loggers } from '@/lib/logger';

export type XeroBackfillTraceStage =
  | 'backfill_requested'
  | 'backfill_completed'
  | 'backfill_denied';

export function xeroBackfillTrace(
  stage: XeroBackfillTraceStage,
  payload: Record<string, unknown>
): void {
  loggers.payment.info(
    {
      event: stage,
      at: new Date().toISOString(),
      ...payload,
    },
    `[${stage}]`
  );
}
