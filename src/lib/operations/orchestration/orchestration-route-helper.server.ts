import 'server-only';

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  orchestrateOperationalMutation,
  operationalSyncJson,
  type OperationalMutationSyncPayload,
} from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';
import type { OperationalMutationKind } from '@/lib/operations/orchestration/synchronize-operational-state';

export type OrchestratedRouteResult<T> = {
  data: T;
  operationalSync: OperationalMutationSyncPayload;
};

/** Standard orchestration wrapper for mutation routes — no silent mutations. */
export async function withOperationalOrchestration<T>(input: {
  userId: string;
  mutation: OperationalMutationKind;
  projectId?: string;
  focusParticipant?: DemoParticipant;
  data: T;
}): Promise<{ data: T; operationalSync: OperationalMutationSyncPayload }> {
  const operationalSync = await orchestrateOperationalMutation({
    userId: input.userId,
    mutation: input.mutation,
    projectId: input.projectId,
    focusParticipant: input.focusParticipant,
  });
  return { data: input.data, operationalSync };
}

export function jsonWithOperationalSync<T>(
  data: T,
  sync: OperationalMutationSyncPayload,
  status = 200
): Response {
  const body = { data, ...operationalSyncJson(sync) };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
