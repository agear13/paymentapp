import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { fetchPilotSnapshot } from '@/lib/deal-network-demo/pilot-store';
import { deriveAgreementHealth } from '@/lib/agreements/health/derive-agreement-health';
import type { AgreementHealthSnapshot } from '@/lib/agreements/health/agreement-health.types';
import {
  summarizeProject,
  type GraphSummaryOverride,
} from '@/lib/projects/project-workspace-summary';

async function fetchGraphOverride(projectId: string): Promise<GraphSummaryOverride | undefined> {
  try {
    const res = await fetch(
      `/api/operations/coordination-snapshot?projectId=${encodeURIComponent(projectId)}`,
      { cache: 'no-store', credentials: 'include' }
    );
    if (!res.ok) return undefined;
    const json = (await res.json()) as {
      data?: {
        summary?: {
          releaseReadyCount: number;
          payoutReadyCount: number;
          participantCount: number;
          blockerCount: number;
        };
      };
    };
    const s = json.data?.summary;
    if (!s) return undefined;
    return {
      releaseReadyCount: s.releaseReadyCount,
      payoutReadyCount: s.payoutReadyCount,
      participantCount: s.participantCount,
      blockerCount: s.blockerCount,
      needsAttention: s.blockerCount > 0 || s.releaseReadyCount < s.participantCount,
    };
  } catch {
    return undefined;
  }
}

export async function loadAgreementHealthForDeal(
  deal: RecentDeal,
  participants: DemoParticipant[],
  options?: { recordTrend?: boolean }
): Promise<AgreementHealthSnapshot> {
  const graph = await fetchGraphOverride(deal.id);
  const summary = summarizeProject(deal, participants, undefined, graph);

  return deriveAgreementHealth({
    projectId: deal.id,
    agreementName: summary.name,
    deal,
    summary,
    participants,
    graph,
    recordTrend: options?.recordTrend ?? false,
  });
}

export async function loadAgreementHealthPortfolio(options?: {
  recordTrend?: boolean;
}): Promise<AgreementHealthSnapshot[]> {
  const snapshot = await fetchPilotSnapshot();
  if (!snapshot) return [];

  const deals = snapshot.deals.filter((d) => !d.archived);
  const participants = snapshot.participants;

  return Promise.all(
    deals.map((deal) =>
      loadAgreementHealthForDeal(deal, participants, { recordTrend: options?.recordTrend })
    )
  );
}
