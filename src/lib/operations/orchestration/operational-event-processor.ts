import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  operationalEventFromMutation,
  type OperationalEvent,
  type OperationalMutationKind,
} from '@/lib/operations/contracts/operational-events';
import { auditEntryFromOperationalEvent } from '@/lib/operations/audit/operational-audit';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import {
  synchronizeOperationalState,
  type OperationalSyncResult,
} from '@/lib/operations/orchestration/synchronize-operational-state';
import type { OperationalCoordinationInput } from '@/lib/operations/selectors/operational-coordination-snapshot';

export type ProcessOperationalEventInput = {
  mutation: OperationalMutationKind;
  projectId: string;
  participants: DemoParticipant[];
  focusParticipant?: DemoParticipant;
  fundingAllocated?: boolean;
  obligationCount?: number;
  obligations?: OperationalCoordinationInput['obligations'];
  funding?: OperationalCoordinationInput['funding'];
  payload?: Record<string, unknown>;
};

export type ProcessOperationalEventResult = OperationalSyncResult & {
  event: OperationalEvent;
  auditEntry: OperationalAuditEntry | null;
};

/**
 * Event-driven operational processor — invalidates, recomputes selectors, regenerates readiness.
 */
export function processOperationalEvent(
  input: ProcessOperationalEventInput
): ProcessOperationalEventResult {
  const event = operationalEventFromMutation(input.mutation, {
    projectId: input.projectId,
    participantId: input.focusParticipant?.id,
    payload: {
      ...input.payload,
      obligationCount: input.obligationCount,
    },
  });

  const sync = synchronizeOperationalState({
    mutation: input.mutation,
    projectId: input.projectId,
    participants: input.participants,
    focusParticipant: input.focusParticipant,
    fundingAllocated: input.fundingAllocated,
    obligations: input.obligations,
    funding: input.funding,
  });

  const auditEntry = auditEntryFromOperationalEvent(event);

  return {
    ...sync,
    event,
    auditEntry,
  };
}
