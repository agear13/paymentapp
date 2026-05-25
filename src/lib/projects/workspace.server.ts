import 'server-only';

import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import { participantsForProject } from '@/lib/projects/participants-for-project';
import { getProjectTreasurySummaryForUser } from '@/lib/projects/funding-sources/funding-sources.server';
import { summarizeProject } from '@/lib/projects/project-workspace-summary';
import { resolveOperationalCoordinationSnapshot } from '@/lib/operations/selectors/resolve-operational-coordination.server';
import { projectGraphSummaryProjection } from '@/lib/operations/selectors/project-graph-summary';

export async function getProjectWorkspaceSummaryForUser(userId: string, projectId: string) {
  const snapshot = await getPilotSnapshotForUser(userId);
  const deal = snapshot.deals.find((d) => d.id === projectId && !d.archived) ?? null;
  if (!deal) {
    return {
      found: false as const,
      deals: snapshot.deals.filter((d) => !d.archived),
    };
  }
  const projectParticipants = participantsForProject(snapshot.participants, deal);
  const treasury = await getProjectTreasurySummaryForUser(userId, projectId);
  const graph = await resolveOperationalCoordinationSnapshot({
    userId,
    projectId,
    participants: snapshot.participants,
  });
  const projection = projectGraphSummaryProjection(graph, deal, snapshot.participants);
  const summary = summarizeProject(deal, snapshot.participants, treasury ?? undefined, {
    releaseReadyCount: projection.releaseReadyCount,
    payoutReadyCount: projection.payoutReadyCount,
    participantCount: projection.participantCount,
    blockerCount: projection.blockerCount,
    fundingLabel: projection.fundingLabel,
    fundingSubcopy: projection.fundingSubcopy,
    needsAttention: projection.needsAttention,
  });
  const deals = snapshot.deals.filter((d) => !d.archived);
  return {
    found: true as const,
    deal,
    summary,
    treasury,
    participantCount: projectParticipants.length,
    deals,
  };
}

export async function getProjectWorkspaceParticipantsForUser(userId: string, projectId: string) {
  const snapshot = await getPilotSnapshotForUser(userId);
  const deal = snapshot.deals.find((d) => d.id === projectId && !d.archived) ?? null;
  if (!deal) {
    return { found: false as const, participants: snapshot.participants };
  }
  return {
    found: true as const,
    deal,
    participants: snapshot.participants,
    projectParticipants: participantsForProject(snapshot.participants, deal),
  };
}
