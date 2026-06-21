import { AI_MARKETING_TEAM } from '@/lib/marketing-jobs/creative-team';
import { PRODUCTION_DOCUMENT_DEFINITIONS } from '@/lib/marketing-jobs/production-documents';
import type {
  CampaignInsightsProjection,
  DistributionPipelineStage,
  DistributionStageStatus,
  LifecycleMilestone,
  LifecycleMilestoneStatus,
  MarketingCampaignLifecycle,
  MarketingOperationsPhase,
  MarketingRoadmapItem,
  MarketingWorkspaceState,
  NextCampaignRecommendation,
  OperationsPublishingCardView,
  PublicationScheduleItem,
} from '@/lib/marketing-jobs/types';

/** Deterministic post-approval timeline offsets (ms). */
export const OPERATIONS_STAGE_OFFSETS = {
  publishing_approved: 0,
  scheduled: 2_000,
  awaiting_results: 5_000,
  performance_review: 8_000,
  operations_complete: 11_000,
} as const;

export const PUBLICATION_SCHEDULE: PublicationScheduleItem[] = [
  { id: 'instagram-carousel', channel: 'Instagram Carousel', day: 'Monday', time: '9:00 AM' },
  { id: 'facebook-post', channel: 'Facebook Post', day: 'Monday', time: '11:00 AM' },
  { id: 'pinterest-pins', channel: 'Pinterest Pins', day: 'Tuesday', time: '8:00 AM' },
  { id: 'instagram-stories', channel: 'Instagram Stories', day: 'Tuesday', time: '6:00 PM' },
  { id: 'newsletter', channel: 'Newsletter', day: 'Wednesday', time: '10:00 AM' },
  { id: 'linkedin', channel: 'LinkedIn', day: 'Thursday', time: '9:00 AM' },
];

const DISTRIBUTION_STAGE_DEFINITIONS: Array<{
  id: string;
  label: string;
  description: string;
  completesAtPhase: MarketingOperationsPhase;
  nextActionPending: string;
  nextActionComplete: string;
}> = [
  {
    id: 'campaign',
    label: 'Campaign',
    description: 'Campaign assets and documents prepared',
    completesAtPhase: 'ready_for_publishing',
    nextActionPending: 'Await creative asset import',
    nextActionComplete: 'Review publishing readiness',
  },
  {
    id: 'approved',
    label: 'Approved',
    description: 'Client approved campaign for publishing',
    completesAtPhase: 'publishing_approved',
    nextActionPending: 'Approve for publishing',
    nextActionComplete: 'Confirm publication schedule',
  },
  {
    id: 'ready_for_publishing',
    label: 'Ready for Publishing',
    description: 'All assets validated for distribution',
    completesAtPhase: 'scheduled',
    nextActionPending: 'Approve for publishing',
    nextActionComplete: 'Review recommended schedule',
  },
  {
    id: 'publishing_schedule',
    label: 'Publishing Schedule',
    description: 'Channel recommendations assigned',
    completesAtPhase: 'awaiting_results',
    nextActionPending: 'Approve publishing to activate schedule',
    nextActionComplete: 'Monitor scheduled placements',
  },
  {
    id: 'awaiting_results',
    label: 'Awaiting Results',
    description: 'Campaign live — collecting engagement signals',
    completesAtPhase: 'performance_review',
    nextActionPending: 'Wait for publishing window',
    nextActionComplete: 'Track early performance indicators',
  },
  {
    id: 'performance_review',
    label: 'Performance Review',
    description: 'AI projections compared against campaign goals',
    completesAtPhase: 'operations_complete',
    nextActionPending: 'Await campaign data window',
    nextActionComplete: 'Review insights and recommendations',
  },
  {
    id: 'completed',
    label: 'Completed',
    description: 'Campaign cycle closed — next campaign recommended',
    completesAtPhase: 'operations_complete',
    nextActionPending: 'Complete performance review',
    nextActionComplete: 'Generate next recommended campaign',
  },
];

const PHASE_ORDER: MarketingOperationsPhase[] = [
  'inactive',
  'ready_for_publishing',
  'publishing_approved',
  'scheduled',
  'awaiting_results',
  'performance_review',
  'operations_complete',
];

function phaseRank(phase: MarketingOperationsPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function defaultCampaignLifecycle(): MarketingCampaignLifecycle {
  return {
    phase: 'inactive',
    publishingApproval: { status: 'none' },
  };
}

export function isCreativeAssetsReady(state: MarketingWorkspaceState): boolean {
  return state.creativeDispatch.creativeProductionStatus === 'complete';
}

export function resolveOperationsPhase(
  lifecycle: MarketingCampaignLifecycle,
  nowMs: number
): MarketingCampaignLifecycle {
  if (lifecycle.phase === 'inactive' || !lifecycle.operationsStartedAt) {
    return lifecycle;
  }

  const startedMs = Date.parse(lifecycle.operationsStartedAt);
  if (Number.isNaN(startedMs)) return lifecycle;

  const elapsed = Math.max(0, nowMs - startedMs);
  let phase: MarketingOperationsPhase = 'publishing_approved';

  if (elapsed >= OPERATIONS_STAGE_OFFSETS.operations_complete) {
    phase = 'operations_complete';
  } else if (elapsed >= OPERATIONS_STAGE_OFFSETS.performance_review) {
    phase = 'performance_review';
  } else if (elapsed >= OPERATIONS_STAGE_OFFSETS.awaiting_results) {
    phase = 'awaiting_results';
  } else if (elapsed >= OPERATIONS_STAGE_OFFSETS.scheduled) {
    phase = 'scheduled';
  }

  if (phase === lifecycle.phase) return lifecycle;
  return { ...lifecycle, phase };
}

function stageStatusForPhase(
  stageIndex: number,
  completesAtPhase: MarketingOperationsPhase,
  currentPhase: MarketingOperationsPhase,
  stages: typeof DISTRIBUTION_STAGE_DEFINITIONS
): DistributionStageStatus {
  const currentRank = phaseRank(currentPhase);
  const completeRank = phaseRank(completesAtPhase);

  if (currentRank >= completeRank) return 'complete';

  const prevCompleteRank =
    stageIndex > 0 ? phaseRank(stages[stageIndex - 1]!.completesAtPhase) : -1;

  if (stageIndex === 0 || currentRank >= prevCompleteRank) return 'active';
  return 'pending';
}

export function buildDistributionPipeline(state: MarketingWorkspaceState): DistributionPipelineStage[] {
  const { campaignLifecycle: lifecycle } = state;
  const currentPhase = lifecycle.phase;

  return DISTRIBUTION_STAGE_DEFINITIONS.map((stage, index) => {
    const status = stageStatusForPhase(index, stage.completesAtPhase, currentPhase, DISTRIBUTION_STAGE_DEFINITIONS);
    const timestamp =
      status === 'complete'
        ? lifecycle.publishingApproval.approvedAt ?? lifecycle.assetsReadyAt
        : status === 'active'
          ? lifecycle.assetsReadyAt
          : undefined;

    return {
      id: stage.id,
      label: stage.label,
      description: stage.description,
      status,
      timestamp,
      nextAction: status === 'complete' ? stage.nextActionComplete : stage.nextActionPending,
    };
  });
}

function milestoneStatus(
  completeWhen: boolean,
  pendingWhen: boolean
): LifecycleMilestoneStatus {
  if (completeWhen) return 'complete';
  if (pendingWhen) return 'pending';
  return 'waiting';
}

export function buildLifecycleTimeline(state: MarketingWorkspaceState): LifecycleMilestone[] {
  const visualJob = state.jobs.find((job) => job.jobType === 'generate_visuals');
  const lifecycle = state.campaignLifecycle;
  const assetsReady = isCreativeAssetsReady(state);

  const packageGenerated =
    state.packageApproval.status === 'approved' || state.creativeDispatch.status === 'dispatched';
  const publishingApproved = lifecycle.publishingApproval.status === 'approved';
  const published =
    phaseRank(lifecycle.phase) >= phaseRank('awaiting_results');
  const reviewComplete = lifecycle.phase === 'operations_complete';

  return [
    {
      id: 'company-brain',
      label: 'Company Brain Complete',
      status: 'complete',
      completedAt: state.campaignContext.companyBrain.knowledgeFile ? undefined : undefined,
    },
    {
      id: 'campaign-strategy',
      label: 'Campaign Strategy Complete',
      status: milestoneStatus(Boolean(visualJob?.status === 'completed'), Boolean(visualJob)),
      completedAt: visualJob?.status === 'completed' ? visualJob.updatedAt : undefined,
    },
    {
      id: 'creative-package',
      label: 'Creative Package Generated',
      status: milestoneStatus(packageGenerated, Boolean(visualJob?.status === 'completed')),
      completedAt: state.creativeDispatch.dispatchedAt,
    },
    {
      id: 'assets-produced',
      label: 'Assets Produced',
      status: milestoneStatus(assetsReady, state.creativeDispatch.status === 'dispatched'),
      completedAt: lifecycle.assetsReadyAt,
    },
    {
      id: 'publishing-approved',
      label: 'Publishing Approved',
      status: milestoneStatus(publishingApproved, assetsReady && !publishingApproved),
      completedAt: lifecycle.publishingApproval.approvedAt,
    },
    {
      id: 'campaign-published',
      label: 'Campaign Published',
      status: milestoneStatus(published, publishingApproved && !published),
      completedAt: published ? lifecycle.operationsStartedAt : undefined,
    },
    {
      id: 'campaign-review',
      label: 'Campaign Review',
      status: milestoneStatus(reviewComplete, published && !reviewComplete),
      completedAt: reviewComplete ? lifecycle.operationsStartedAt : undefined,
    },
  ];
}

export function buildOperationsPublishingCard(state: MarketingWorkspaceState): OperationsPublishingCardView | null {
  if (!isCreativeAssetsReady(state)) return null;

  const { campaignLifecycle: lifecycle } = state;
  const readyCount = state.assets.filter((asset) => asset.status === 'ready').length;
  const approved = lifecycle.publishingApproval.status === 'approved';

  let campaignStatus = 'Ready for Publishing';
  if (lifecycle.phase === 'operations_complete') {
    campaignStatus = 'Operations Complete';
  } else if (approved) {
    campaignStatus = 'Publishing Approved';
  }

  return {
    campaignStatus,
    creativeAssetsComplete: readyCount || 12,
    clientApprovalStatus: approved ? 'Approved' : 'Pending',
    distributionStatus:
      lifecycle.phase === 'inactive' || lifecycle.phase === 'ready_for_publishing'
        ? 'Waiting'
        : lifecycle.phase === 'operations_complete'
          ? 'Complete'
          : 'In Progress',
    showApproveCta: lifecycle.publishingApproval.status === 'pending',
    showSchedule: approved,
  };
}

export function buildPublicationScheduleView(state: MarketingWorkspaceState): PublicationScheduleItem[] | null {
  if (state.campaignLifecycle.publishingApproval.status !== 'approved') return null;
  return PUBLICATION_SCHEDULE;
}

export function buildCampaignInsights(state: MarketingWorkspaceState): CampaignInsightsProjection | null {
  if (!isCreativeAssetsReady(state)) return null;

  return {
    expectedOrganicReach: 18_400,
    expectedWebsiteVisits: 2_350,
    estimatedLeads: 41,
    estimatedProductionSavingHours: 11.2,
    knowledgeGapsIdentified: 3,
    recommendations: 6,
  };
}

export function buildMarketingRoadmap(state: MarketingWorkspaceState): MarketingRoadmapItem[] {
  const lifecycle = state.campaignLifecycle;
  const assetsReady = isCreativeAssetsReady(state);

  return [
    {
      id: 'current-campaign',
      label: 'Current Campaign',
      status: assetsReady ? 'completed' : 'upcoming',
    },
    {
      id: 'publishing',
      label: 'Publishing',
      status:
        lifecycle.publishingApproval.status === 'pending'
          ? 'pending_approval'
          : lifecycle.publishingApproval.status === 'approved'
            ? 'completed'
            : assetsReady
              ? 'pending_approval'
              : 'upcoming',
    },
    {
      id: 'results-review',
      label: 'Results Review',
      status:
        lifecycle.phase === 'operations_complete'
          ? 'completed'
          : phaseRank(lifecycle.phase) >= phaseRank('awaiting_results')
            ? 'upcoming'
            : 'upcoming',
    },
    {
      id: 'next-campaign',
      label: 'Next Campaign',
      status: lifecycle.phase === 'operations_complete' ? 'recommended' : 'upcoming',
    },
  ];
}

export function buildOperationsCompletionMetrics(state: MarketingWorkspaceState) {
  const readyCount = state.assets.filter((asset) => asset.status === 'ready').length;

  return {
    creativeAssets: readyCount || 12,
    campaignDocuments: PRODUCTION_DOCUMENT_DEFINITIONS.length,
    estimatedTimeSavedHours: 11.2,
    aiSpecialists: AI_MARKETING_TEAM.length,
    qualityAssurance: 'Passed' as const,
    brandCompliance: 98,
    knowledgeCoverage: 96,
    campaignStatus: buildOperationsPublishingCard(state)?.campaignStatus ?? 'Ready for Publishing',
  };
}

export { buildNextCampaignRecommendation, NEXT_CAMPAIGN_RECOMMENDATION } from '@/lib/marketing-jobs/campaign-recommendations';
