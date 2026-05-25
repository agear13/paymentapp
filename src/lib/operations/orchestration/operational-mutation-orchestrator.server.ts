import 'server-only';

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  refreshDealNetworkPilotObligationsForUser,
} from '@/lib/deal-network-demo/deal-network-pilot-obligations';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import { reserveFundingAgainstObligations } from '@/lib/operations/funding/reserve-funding-against-obligations.server';
import { executeStrictOperationalOrchestration } from '@/lib/operations/orchestration/strict-operational-orchestration';
import { resolveOperationalCoordinationSnapshot } from '@/lib/operations/selectors/resolve-operational-coordination.server';
import type { OperationalMutationKind, OperationalSyncScope } from '@/lib/operations/orchestration/synchronize-operational-state';
import type { ProcessOperationalEventResult } from '@/lib/operations/orchestration/operational-event-processor';
import type { OperationalEvent } from '@/lib/operations/contracts/operational-events';

export type OperationalMutationSyncPayload = {
  invalidatedScopes: OperationalSyncScope[];
  releaseEligibleCount: number;
  payoutReadyCount: number;
  obligationCount: number;
  releaseEligibleObligationCount: number;
  fundingAllocated: boolean;
  operationalEvent: ProcessOperationalEventResult['event'];
  completionEvent: OperationalEvent;
  auditEntry: ProcessOperationalEventResult['auditEntry'];
  syncCompletedAt: string;
};

/**
 * SINGLE server orchestration entrypoint after operational mutations.
 * Refreshes persisted obligations, recomputes coordination snapshot, returns invalidation scopes.
 */
export async function orchestrateOperationalMutation(input: {
  userId: string;
  mutation: OperationalMutationKind;
  projectId?: string;
  focusParticipant?: DemoParticipant;
}): Promise<OperationalMutationSyncPayload> {
  const snapshot = await getPilotSnapshotForUser(input.userId);
  const projectId = input.projectId ?? input.focusParticipant?.dealId ?? snapshot.deals[0]?.id;

  let fundingReservation: Awaited<ReturnType<typeof reserveFundingAgainstObligations>> | null = null;

  if (projectId) {
    const deal = snapshot.deals.find((d) => d.id === projectId);
    if (deal) {
      fundingReservation = await reserveFundingAgainstObligations({
        userId: input.userId,
        deal,
        participants: snapshot.participants,
      });
    } else {
      await refreshDealNetworkPilotObligationsForUser(input.userId);
    }
  } else {
    await refreshDealNetworkPilotObligationsForUser(input.userId);
  }

  const refreshed = await getPilotSnapshotForUser(input.userId);
  const effectiveProjectId = projectId ?? refreshed.deals[0]?.id ?? 'unknown';
  const dealParticipants = refreshed.participants.filter(
    (p) => !p.dealId || p.dealId === effectiveProjectId
  );

  const graph = await resolveOperationalCoordinationSnapshot({
    userId: input.userId,
    projectId: effectiveProjectId,
    participants: refreshed.participants,
  });

  const processed = executeStrictOperationalOrchestration({
    mutation: input.mutation,
    projectId: effectiveProjectId,
    participants: dealParticipants,
    focusParticipant: input.focusParticipant,
    fundingAllocated: graph.funding.allocated,
    obligationCount: graph.obligations.length,
    obligations: graph.obligations.map((o) => ({
      id: o.id,
      participantId: o.participantId,
      amount: o.amount,
      amountFunded: o.amountFunded,
      currency: o.currency,
      readiness: o.readiness,
    })),
    funding: graph.fundingInput ?? undefined,
    payload: {
      releaseEligibleObligationCount: graph.obligations.filter((o) => o.operational.releaseReady)
        .length,
      payoutReadyCount: graph.summary.payoutReadyCount,
      fundingReservation,
    },
  });

  return {
    invalidatedScopes: processed.invalidatedScopes,
    releaseEligibleCount: processed.snapshot.summary.releaseReadyCount,
    payoutReadyCount: processed.snapshot.summary.payoutReadyCount,
    obligationCount: graph.obligations.length,
    releaseEligibleObligationCount: graph.obligations.filter((o) => o.operational.releaseReady)
      .length,
    fundingAllocated: graph.funding.allocated,
    operationalEvent: processed.event,
    completionEvent: processed.completionEvent,
    auditEntry: processed.auditEntry,
    syncCompletedAt: processed.syncCompletedAt,
  };
}

export function operationalSyncJson(payload: OperationalMutationSyncPayload) {
  return { operationalSync: payload };
}
