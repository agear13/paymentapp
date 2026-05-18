import 'server-only';

import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import { participantsForProject } from '@/lib/projects/participants-for-project';
import { summarizeProject } from '@/lib/projects/project-workspace-summary';

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
  const summary = summarizeProject(deal, snapshot.participants);
  const deals = snapshot.deals.filter((d) => !d.archived);
  return {
    found: true as const,
    deal,
    summary,
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
