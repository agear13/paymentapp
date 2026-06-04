import { loggers } from '@/lib/logger';

export type AssistedReviewSettlementStage =
  | 'bank_review_settlement_started'
  | 'bank_review_settlement_completed'
  | 'bank_review_settlement_failed'
  | 'crypto_review_settlement_started'
  | 'crypto_review_settlement_completed'
  | 'crypto_review_settlement_failed';

export function assistedReviewSettlementTrace(
  stage: AssistedReviewSettlementStage,
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
