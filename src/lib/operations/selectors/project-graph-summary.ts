import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import {
  projectParticipantsReadyFromGraph,
  treasuryFundingLabelFromGraph,
} from '@/lib/operations/selectors/operational-graph-adapter';
import type { ProjectWorkspaceSummary } from '@/lib/projects/project-workspace-summary';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';
import { getProjectDisplayName } from '@/lib/projects/get-project-display-name';
import { formatOperationalStage } from '@/lib/projects/format-operational-stage';

function formatValue(deal: RecentDeal): string {
  const amount = deal.value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (deal.projectValueCurrency === 'AUD') return `$${amount} AUD`;
  return `$${amount}`;
}

export type ProjectGraphSummaryProjection = {
  releaseReadyCount: number;
  payoutReadyCount: number;
  participantCount: number;
  blockerCount: number;
  fundingLabel: string;
  fundingSubcopy: string;
  needsAttention: boolean;
};

/** Graph-derived project metrics — sole source for readiness counts and funding labels. */
export function projectGraphSummaryProjection(
  snapshot: OperationalCoordinationSnapshot,
  deal: RecentDeal,
  participants: DemoParticipant[]
): ProjectGraphSummaryProjection {
  const counts = projectParticipantsReadyFromGraph(snapshot, deal, participants);
  const funding = treasuryFundingLabelFromGraph(snapshot);
  const needsAttention =
    snapshot.summary.blockerCount > 0 ||
    counts.releaseReadyCount < counts.participantCount ||
    !snapshot.funding.stage?.releaseFunded;

  return {
    releaseReadyCount: counts.releaseReadyCount,
    payoutReadyCount: counts.payoutReadyCount,
    participantCount: counts.participantCount,
    blockerCount: snapshot.summary.blockerCount,
    fundingLabel: funding.fundingLabel,
    fundingSubcopy: funding.fundingSubcopy,
    needsAttention,
  };
}

/** Apply graph projection onto workspace summary — replaces local counting logic. */
export function applyGraphProjectionToSummary(
  summary: ProjectWorkspaceSummary,
  projection: ProjectGraphSummaryProjection
): ProjectWorkspaceSummary {
  return {
    ...summary,
    participantsReady: projection.releaseReadyCount,
    participantsPending: Math.max(0, projection.participantCount - projection.releaseReadyCount),
    participantCount: projection.participantCount,
    fundingLabel: projection.fundingLabel,
    fundingSubcopy: projection.fundingSubcopy,
    needsAttention: projection.needsAttention,
    payoutLabel:
      projection.releaseReadyCount > 0
        ? `${projection.releaseReadyCount} release-ready`
        : summary.payoutLabel,
  };
}

export function summarizeProjectLabelsFromGraph(
  deal: RecentDeal,
  snapshot: OperationalCoordinationSnapshot,
  participants: DemoParticipant[],
  treasury?: ProjectTreasurySummary
): Pick<
  ProjectWorkspaceSummary,
  | 'participantsReady'
  | 'participantsPending'
  | 'participantCount'
  | 'fundingLabel'
  | 'fundingSubcopy'
  | 'needsAttention'
  | 'payoutLabel'
> {
  const projection = projectGraphSummaryProjection(snapshot, deal, participants);
  return {
    participantCount: projection.participantCount,
    participantsReady: projection.releaseReadyCount,
    participantsPending: Math.max(0, projection.participantCount - projection.releaseReadyCount),
    fundingLabel: treasury?.fundingLabel ?? projection.fundingLabel,
    fundingSubcopy: treasury?.fundingSubcopy ?? projection.fundingSubcopy,
    needsAttention: projection.needsAttention || (treasury?.projectHealth === 'settlement_risk'),
    payoutLabel:
      projection.releaseReadyCount > 0
        ? `${projection.releaseReadyCount} release-ready`
        : deal.status === 'Paid'
          ? 'Settled'
          : deal.status,
  };
}

export function projectDisplayName(deal: RecentDeal): string {
  return getProjectDisplayName({ dealName: deal.dealName });
}

export function projectStageLabel(deal: RecentDeal): string {
  return formatOperationalStage(deal.currentStage);
}

export { formatValue as formatProjectValue };
