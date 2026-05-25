import type { OperationalEvent } from '@/lib/operations/contracts/operational-events';
import {
  processOperationalEvent,
  type ProcessOperationalEventInput,
  type ProcessOperationalEventResult,
} from '@/lib/operations/orchestration/operational-event-processor';
import { buildOrchestrationCompletion } from '@/lib/operations/orchestration/orchestration-contract';

export type StrictOrchestrationResult = ProcessOperationalEventResult & {
  completionEvent: OperationalEvent;
  syncCompletedAt: string;
};

/** Strict orchestration — persist → event → invalidate → recompute → invariants → completion event. */
export function executeStrictOperationalOrchestration(
  input: ProcessOperationalEventInput
): StrictOrchestrationResult {
  const processed = processOperationalEvent(input);
  const completion = buildOrchestrationCompletion({
    mutation: input.mutation,
    projectId: input.projectId,
    participantId: input.focusParticipant?.id,
    invalidatedScopes: processed.invalidatedScopes,
    snapshot: processed.snapshot,
    event: processed.event,
    auditEntry: processed.auditEntry,
  });
  return {
    ...processed,
    completionEvent: completion.completionEvent,
    syncCompletedAt: completion.syncCompletedAt,
  };
}
