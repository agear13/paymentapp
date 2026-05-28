import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { isCompensationExempt } from '@/lib/participants/participant-compensation';
import {
  isParticipantEarningsConfigured,
  isParticipantPayoutReadyForKpi,
} from '@/lib/operations/selectors/participant-earnings-selectors';

/** Row-level counts from persisted participants only — must match canonical reducer KPIs. */
export function countPersistedParticipantMetrics(participants: DemoParticipant[]) {
  const active = participants.filter((p) => p.name?.trim());
  let earningsConfiguredCount = 0;
  let payoutReadyCount = 0;
  let approvedAgreementCount = 0;

  for (const p of active) {
    if (isParticipantEarningsConfigured(p) || isCompensationExempt(p)) {
      earningsConfiguredCount += 1;
    }
    if (p.approvalStatus === 'Approved') approvedAgreementCount += 1;
    if (isParticipantPayoutReadyForKpi(p)) payoutReadyCount += 1;
  }

  return {
    participantCount: active.length,
    earningsConfiguredCount,
    payoutReadyCount,
    approvedAgreementCount,
  };
}
