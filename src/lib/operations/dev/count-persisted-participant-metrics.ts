import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  hasPersistedCompensationTerms,
  hasPersistedPayoutReadyForKpi,
  isParticipantCompensationExempt,
} from '@/lib/operations/primitives/participant-earnings-primitives';

/** Row-level counts from persisted participants only — must match canonical reducer KPIs. */
export function countPersistedParticipantMetrics(participants: DemoParticipant[]) {
  const active = participants.filter((p) => p.name?.trim());
  let earningsConfiguredCount = 0;
  let payoutReadyCount = 0;
  let approvedAgreementCount = 0;

  for (const p of active) {
    if (hasPersistedCompensationTerms(p) || isParticipantCompensationExempt(p)) {
      earningsConfiguredCount += 1;
    }
    if (p.approvalStatus === 'Approved') approvedAgreementCount += 1;
    if (hasPersistedPayoutReadyForKpi(p)) payoutReadyCount += 1;
  }

  return {
    participantCount: active.length,
    earningsConfiguredCount,
    payoutReadyCount,
    approvedAgreementCount,
  };
}
