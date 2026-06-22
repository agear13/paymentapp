import { AI_MARKETING_TEAM, CREATIVE_PRODUCTION_ESTIMATE_MINUTES, getMarketingLeadSpecialist, getPipelineSpecialists, getSpecialistById } from '@/lib/marketing-jobs/creative-team';
import { buildOperationsCompletionMetrics } from '@/lib/marketing-jobs/campaign-lifecycle';
import {
  buildProductionDocuments,
  computePackageHealth,
  countCompleteDocuments,
  PRODUCTION_DOCUMENT_DEFINITIONS,
  TOTAL_PACKAGE_FILES,
} from '@/lib/marketing-jobs/production-documents';
import type {
  ActivityFeedEntry,
  AiTeamPerformanceMetrics,
  CampaignCompletionSummary,
  CampaignStatusSnapshot,
  MarketingJob,
  MarketingWorkspaceState,
  PackageHealthView,
  SpecialistDisplayStatus,
  SpecialistPipelineEntry,
} from '@/lib/marketing-jobs/types';
import { isVisualJobInFlight, isVisualJobReadyForDispatch } from '@/lib/marketing-jobs/simulation';

function mapStageStatus(
  stageStatus: 'pending' | 'active' | 'completed'
): SpecialistDisplayStatus {
  switch (stageStatus) {
    case 'completed':
      return 'completed';
    case 'active':
      return 'working';
    default:
      return 'waiting';
  }
}

function elapsedForJob(job: MarketingJob): number {
  const createdMs = Date.parse(job.createdAt);
  if (Number.isNaN(createdMs)) return 0;
  return Math.max(0, Date.now() - createdMs);
}

function progressForSpecialist(
  specialist: (typeof AI_MARKETING_TEAM)[number],
  elapsed: number,
  displayStatus: SpecialistDisplayStatus
): number {
  if (displayStatus === 'completed') return 100;
  if (displayStatus !== 'working') return 0;

  const index = AI_MARKETING_TEAM.findIndex((item) => item.id === specialist.id);
  const prevOffset = index > 0 ? AI_MARKETING_TEAM[index - 1]!.offsetMs : 0;
  const range = Math.max(1, specialist.offsetMs - prevOffset);
  const partial = Math.min(1, Math.max(0, (elapsed - prevOffset) / range));
  const prevProgress = index > 0 ? AI_MARKETING_TEAM[index - 1]!.progress : 0;
  return Math.round(prevProgress + partial * (specialist.progress - prevProgress));
}

export function buildSpecialistPipeline(job: MarketingJob | null): SpecialistPipelineEntry[] {
  if (!job) {
    return getPipelineSpecialists().map((specialist) => ({
      id: specialist.id,
      role: specialist.role,
      name: specialist.stageTitle,
      status: 'waiting' as SpecialistDisplayStatus,
      currentTask: 'Waiting',
      progress: 0,
      confidence: specialist.confidence,
      icon: specialist.icon,
    }));
  }

  const stageById = new Map(job.stages.map((stage) => [stage.specialistId, stage]));
  const elapsed = elapsedForJob(job);

  return getPipelineSpecialists().map((specialist) => {
    const stage = stageById.get(specialist.id);
    const displayStatus = stage ? mapStageStatus(stage.status) : 'waiting';

    let currentTask = 'Waiting';
    if (displayStatus === 'working') currentTask = specialist.workingActivity;
    else if (displayStatus === 'completed') currentTask = specialist.completedActivity;
    else currentTask = 'Waiting';

    return {
      id: specialist.id,
      role: specialist.role,
      name: specialist.stageTitle,
      status: displayStatus,
      currentTask,
      progress: progressForSpecialist(specialist, elapsed, displayStatus),
      completedAt: stage?.completedAt,
      confidence: specialist.confidence,
      icon: specialist.icon,
    };
  });
}

export function buildActivityFeed(job: MarketingJob | null): ActivityFeedEntry[] {
  const pipeline = buildSpecialistPipeline(job);
  return pipeline.map((entry) => ({
    id: entry.id,
    specialistId: entry.id,
    role: entry.role,
    message: entry.currentTask,
    status: entry.status,
    timestamp: entry.completedAt,
  }));
}

export function buildCampaignStatus(
  state: MarketingWorkspaceState,
  job: MarketingJob | null
): CampaignStatusSnapshot {
  const { creativeDispatch, packageApproval } = state;

  if (creativeDispatch.creativeProductionStatus === 'complete') {
    const opsStatus = state.campaignLifecycle.phase === 'operations_complete'
      ? 'Campaign operations complete'
      : 'Creative assets ready — proceed to Marketing Operations';
    return {
      phase: 'completed',
      headline: 'Campaign Complete',
      detail: opsStatus,
      progress: 100,
    };
  }

  if (creativeDispatch.status === 'dispatched') {
    return {
      phase: 'creative_production',
      headline: 'AI Creative Team',
      detail: `Creative Production — ${creativeDispatch.productionPhase ?? 'Preparing Canva assets'}`,
      progress: creativeDispatch.creativeProductionStatus === 'in_progress' ? 55 : 20,
    };
  }

  if (state.dispatchDeployment.running) {
    return {
      phase: 'dispatching',
      headline: 'Dispatching Package',
      detail: 'Deploying campaign package to AI Creative Team…',
      progress: 95,
    };
  }

  if (packageApproval.status === 'pending' && job && isVisualJobReadyForDispatch(job)) {
    return {
      phase: 'awaiting_approval',
      headline: 'Campaign Package Ready',
      detail: 'Review and approve the package before dispatch.',
      progress: 100,
    };
  }

  if (job && isVisualJobInFlight(job)) {
    const active = job.stages.find((s) => s.status === 'active');
    return {
      phase: 'team_working',
      headline: 'AI Marketing Team',
      detail: active ? `${active.title} — ${active.description}` : 'Specialists coordinating…',
      progress: job.progress,
    };
  }

  if (job && isVisualJobReadyForDispatch(job)) {
    return {
      phase: 'awaiting_approval',
      headline: 'Campaign Package Ready',
      detail: 'Awaiting package approval.',
      progress: 100,
    };
  }

  return {
    phase: 'idle',
    headline: 'Campaign Ready',
    detail: 'Start the AI Marketing Team to begin production.',
    progress: 0,
  };
}

export function buildPackageHealthView(job: MarketingJob | null): PackageHealthView {
  const elapsed = job ? elapsedForJob(job) : 0;
  const documents = buildProductionDocuments(elapsed);
  const healthPercent = computePackageHealth(documents);
  const completeCount = countCompleteDocuments(documents);
  const ready = Boolean(job && isVisualJobReadyForDispatch(job));

  return {
    filesGenerated: ready
      ? TOTAL_PACKAGE_FILES
      : Math.max(completeCount, Math.round((healthPercent / 100) * TOTAL_PACKAGE_FILES)),
    totalFiles: TOTAL_PACKAGE_FILES,
    healthPercent: ready ? 100 : healthPercent,
    readyForDispatch: ready,
    documents,
  };
}

export function buildApprovalSummary(state: MarketingWorkspaceState, job: MarketingJob | null) {
  const health = buildPackageHealthView(job);
  const lead = getSpecialistById('marketing-lead');

  return {
    filesIncluded: health.filesGenerated,
    estimatedCreativeMinutes: CREATIVE_PRODUCTION_ESTIMATE_MINUTES,
    aiConfidence: lead?.confidence ?? 96,
    knowledgeCoverage: 94,
    brandCompliance: 98,
  };
}

export function buildAiTeamPerformance(state: MarketingWorkspaceState): AiTeamPerformanceMetrics {
  const complete = state.creativeDispatch.creativeProductionStatus === 'complete';
  const readyCount = state.assets.filter((a) => a.status === 'ready').length;

  return {
    businessKnowledgeCoverage: complete ? 94 : 88,
    brandCompliance: complete ? 98 : 95,
    contentQuality: complete ? 96 : 92,
    creativeReadiness: complete ? 97 : 90,
    marketingConfidence: complete ? 95 : 93,
    overallPerformance: complete ? 96 : 92,
    estimatedHumanTimeSavedHours: complete ? 11.2 : 8.5,
    assetsProduced: complete ? 12 : readyCount + 6,
    recommendationsGenerated: 6,
    knowledgeGapsIdentified: 3,
  };
}

export function buildCampaignCompletion(state: MarketingWorkspaceState): CampaignCompletionSummary | null {
  if (state.creativeDispatch.creativeProductionStatus !== 'complete') return null;

  const readyCount = state.assets.filter((a) => a.status === 'ready').length;
  const ops = buildOperationsCompletionMetrics(state);

  return {
    creativeAssetsProduced: 12,
    visualAssets: readyCount || 6,
    canvaDesigns: readyCount || 6,
    campaignDocuments: PRODUCTION_DOCUMENT_DEFINITIONS.length,
    productionTimeMinutes: 17,
    qualityAssurance: ops.qualityAssurance,
    brandCompliance: ops.brandCompliance,
    knowledgeCoverage: ops.knowledgeCoverage,
    aiSpecialists: ops.aiSpecialists,
    estimatedTimeSavedHours: ops.estimatedTimeSavedHours,
    clientReportReady: true,
    aiTeamReportReady: true,
    campaignStatus: ops.campaignStatus,
  };
}

export function getSpecialistDetail(specialistId: string) {
  return getSpecialistById(specialistId);
}

export function buildProductionFeedMessages(job: MarketingJob | null): string[] {
  if (!job) return ['Waiting for AI Marketing Team to start…'];

  const messages: string[] = [];
  for (const specialist of AI_MARKETING_TEAM) {
    const stage = job.stages.find((s) => s.specialistId === specialist.id);
    if (!stage) continue;
    if (stage.status === 'completed') {
      messages.push(`${specialist.role}: ${specialist.completedActivity}`);
    } else if (stage.status === 'active') {
      messages.push(`${specialist.role}: ${specialist.workingActivity}`);
    }
  }

  if (messages.length === 0) messages.push('Assigning specialists…');
  return messages.slice(-5);
}

export function downloadReportJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function buildClientReport(state: MarketingWorkspaceState) {
  const completion = buildCampaignCompletion(state);
  const performance = buildAiTeamPerformance(state);
  return {
    company: state.campaignContext.company.name,
    campaign: state.campaignContext.campaign.title,
    completedAt: new Date().toISOString(),
    deliverables: completion,
    performance,
    assets: state.assets.filter((a) => a.status === 'ready').map((a) => ({
      type: a.type,
      label: a.label,
      previewUrl: a.previewUrl,
      downloadUrl: a.downloadUrl,
    })),
  };
}

export function buildAiTeamReport(state: MarketingWorkspaceState) {
  const job = state.jobs.find((j) => j.jobType === 'generate_visuals') ?? null;
  return {
    company: state.campaignContext.company.name,
    campaign: state.campaignContext.campaign.title,
    generatedAt: new Date().toISOString(),
    performance: buildAiTeamPerformance(state),
    specialists: buildSpecialistPipeline(job),
    activity: buildActivityFeed(job),
    documents: buildPackageHealthView(job).documents,
  };
}

/** Planning-phase report — strategy only, no creative assets. */
export function buildCampaignStrategyReport(state: MarketingWorkspaceState) {
  const job = state.jobs.find((j) => j.jobType === 'generate_visuals') ?? null;
  const packageHealth = buildPackageHealthView(job);
  return {
    company: state.campaignContext.company.name,
    campaignTitle: state.campaignContext.campaign.title,
    generatedAt: new Date().toISOString(),
    phase: 'strategy',
    companyBrain: state.campaignContext.companyBrain,
    campaign: state.campaignContext.campaign,
    article: state.campaignContext.article,
    copy: state.campaignContext.copy,
    visualRecommendations: state.campaignContext.visualRecommendations,
    documents: packageHealth.documents,
    specialists: buildSpecialistPipeline(job),
  };
}
