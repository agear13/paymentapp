import 'server-only';

import { refreshDealNetworkPilotObligationsForDeal } from '@/lib/deal-network-demo/deal-network-pilot-obligations';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import { orchestrateOperationalMutation } from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';

/**
 * Same post-persist pipeline as workspace conversation import:
 * refresh derived obligations → orchestrate coordination graph → settlement readiness inputs.
 */
export async function refreshProjectObligationsAfterParticipantPersist(
  userId: string,
  projectId: string
): Promise<void> {
  const snapshot = await getPilotSnapshotForUser(userId);
  const deal = snapshot.deals.find((row) => row.id === projectId);
  if (!deal) return;

  await refreshDealNetworkPilotObligationsForDeal(userId, deal, snapshot.participants);
  await orchestrateOperationalMutation({
    userId,
    mutation: 'snapshot_persist',
    projectId,
  });
}
