import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import { hasConfirmedPayout } from '@/lib/operations/primitives/participant-earnings-primitives';

/** KPI cards on project participants view — single source for confirmation counting. */
export function deriveParticipantViewStats(input: {
  canonicalKpis: OperationalKPIs | null | undefined;
  graphParticipants: OperationalCoordinationSnapshot['participants'];
}): {
  pendingAgreements: number;
  missingConfirmation: number;
  readyForPayout: number;
  activeAttribution: number;
} {
  if (!input.canonicalKpis) {
    return {
      pendingAgreements: 0,
      missingConfirmation: 0,
      readyForPayout: 0,
      activeAttribution: 0,
    };
  }

  const missingConfirmation = input.graphParticipants.filter(
    (row) => !hasConfirmedPayout(row.participant)
  ).length;

  return {
    readyForPayout: input.canonicalKpis.payoutReadyCount,
    pendingAgreements: Math.max(
      0,
      input.canonicalKpis.participantCount - input.canonicalKpis.approvedAgreementCount
    ),
    activeAttribution: input.canonicalKpis.attributionActiveCount,
    missingConfirmation,
  };
}
