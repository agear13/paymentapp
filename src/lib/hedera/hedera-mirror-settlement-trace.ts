import { loggers } from '@/lib/logger';

export type HederaMirrorSettlementStage =
  | 'hedera_verify_settlement_started'
  | 'hedera_verify_settlement_completed'
  | 'hedera_verify_settlement_failed';

export function hederaMirrorSettlementTrace(
  stage: HederaMirrorSettlementStage,
  payload: Record<string, unknown>
): void {
  loggers.hedera.info(
    {
      event: stage,
      at: new Date().toISOString(),
      ...payload,
    },
    `[${stage}]`
  );
}
