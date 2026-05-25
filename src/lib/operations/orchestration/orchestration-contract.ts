import type { OperationalEvent } from '@/lib/operations/contracts/operational-events';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import type { OperationalSyncScope } from '@/lib/operations/orchestration/synchronize-operational-state';

/** Explicit orchestration contract — every mutation must complete all steps. */
export type OrchestrationCompletion = {
  mutation: string;
  projectId: string;
  participantId?: string;
  invalidatedScopes: OperationalSyncScope[];
  snapshot: OperationalCoordinationSnapshot;
  event: OperationalEvent;
  completionEvent: OperationalEvent;
  auditEntry: OperationalAuditEntry | null;
  syncCompletedAt: string;
};

export function synchronizationCompletedEvent(input: {
  projectId: string;
  participantId?: string;
  mutation: string;
  invalidatedScopes: OperationalSyncScope[];
}): OperationalEvent {
  return {
    type: 'SYNCHRONIZATION_COMPLETED',
    projectId: input.projectId,
    participantId: input.participantId,
    timestamp: new Date().toISOString(),
    source: 'server',
    payload: {
      mutation: input.mutation,
      invalidatedScopes: input.invalidatedScopes,
    },
  };
}

export function buildOrchestrationCompletion(input: {
  mutation: string;
  projectId: string;
  participantId?: string;
  invalidatedScopes: OperationalSyncScope[];
  snapshot: OperationalCoordinationSnapshot;
  event: OperationalEvent;
  auditEntry: OperationalAuditEntry | null;
}): OrchestrationCompletion {
  const syncCompletedAt = new Date().toISOString();
  return {
    mutation: input.mutation,
    projectId: input.projectId,
    participantId: input.participantId,
    invalidatedScopes: input.invalidatedScopes,
    snapshot: input.snapshot,
    event: input.event,
    completionEvent: synchronizationCompletedEvent({
      projectId: input.projectId,
      participantId: input.participantId,
      mutation: input.mutation,
      invalidatedScopes: input.invalidatedScopes,
    }),
    auditEntry: input.auditEntry,
    syncCompletedAt,
  };
}
