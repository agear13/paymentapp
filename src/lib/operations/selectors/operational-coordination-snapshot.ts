/**
 * Centralized operational coordination snapshot — authoritative truth for all surfaces.
 */

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { OperationalBlockerDetail } from '@/lib/operations/contracts/approval-state';
import {
  deriveAgreementApprovalState,
  deriveOperationalBlocker,
} from '@/lib/operations/derivations/derive-approval-state';
import type { CatalogItemRef } from '@/lib/operations/derivations/commission-scope';
import { deriveObligationState, type RawObligationInput } from '@/lib/operations/derivations/derive-obligation-state';
import {
  derivePayoutReleaseReadiness,
  derivePayoutReleaseReadinessBatch,
} from '@/lib/operations/readiness/derive-payout-release-readiness';
import { deriveParticipantPayoutReadiness } from '@/lib/operations/readiness/participant-readiness';
import { hydrateOperationalParticipants } from '@/lib/operations/hydration/hydrate-operational-participant';
import { warnOperationalInconsistency } from '@/lib/operations/dev/operational-diagnostics';

export type OperationalCoordinationSnapshot = {
  participants: Array<{
    participant: DemoParticipant;
    agreementApproval: ReturnType<typeof deriveAgreementApprovalState>;
    payoutReadiness: ReturnType<typeof deriveParticipantPayoutReadiness>;
    releaseReadiness: ReturnType<typeof derivePayoutReleaseReadiness>;
    blockers: OperationalBlockerDetail[];
  }>;
  obligations: ReturnType<typeof deriveObligationState>[];
  summary: {
    participantCount: number;
    payoutReadyCount: number;
    releaseReadyCount: number;
    blockerCount: number;
    allBlockers: OperationalBlockerDetail[];
  };
  funding: {
    allocated: boolean;
  };
};

export type OperationalCoordinationInput = {
  participants: DemoParticipant[];
  obligations?: RawObligationInput[];
  projectId?: string;
  fundingAllocated?: boolean;
  catalogItemsByParticipant?: Record<string, CatalogItemRef[]>;
};

/** Authoritative coordination truth — future screens must consume this selector. */
export function getOperationalCoordinationSnapshot(
  input: OperationalCoordinationInput
): OperationalCoordinationSnapshot {
  const participants = hydrateOperationalParticipants(input.participants);
  const obligations = (input.obligations ?? []).map((o) => deriveObligationState(o));

  const participantSnapshots = participants.map((participant) => {
    const catalogItems = input.catalogItemsByParticipant?.[participant.id];
    const agreementApproval = deriveAgreementApprovalState(participant);
    const payoutReadiness = deriveParticipantPayoutReadiness(participant);
    const releaseReadiness = derivePayoutReleaseReadiness(participant, {
      projectId: input.projectId,
      fundingAllocated: input.fundingAllocated,
      catalogItems,
    });
    const blockers = deriveOperationalBlocker(participant, input.projectId);

    warnOperationalInconsistency({
      participant,
      agreementApproval,
      payoutReadiness,
      releaseReadiness,
      catalogItems,
    });

    return {
      participant,
      agreementApproval,
      payoutReadiness,
      releaseReadiness,
      blockers,
    };
  });

  const releaseReadinessBatch = derivePayoutReleaseReadinessBatch(participants, {
    projectId: input.projectId,
    fundingAllocated: input.fundingAllocated,
    catalogItemsByParticipant: input.catalogItemsByParticipant,
  });

  const allBlockers = participantSnapshots.flatMap((s) => s.blockers);

  return {
    participants: participantSnapshots,
    obligations,
    summary: {
      participantCount: participants.length,
      payoutReadyCount: participantSnapshots.filter((s) => s.payoutReadiness.payoutReady).length,
      releaseReadyCount: releaseReadinessBatch.filter((r) => r.releaseReady).length,
      blockerCount: allBlockers.length,
      allBlockers,
    },
    funding: {
      allocated: input.fundingAllocated ?? false,
    },
  };
}
