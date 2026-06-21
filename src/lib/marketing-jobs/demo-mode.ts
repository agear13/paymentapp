import { v4 as uuidv4 } from 'uuid';
import { createInitialCampaignAssets } from '@/lib/marketing-jobs/asset-catalog';
import { buildDefaultCampaignContext } from '@/lib/marketing-jobs/campaign-context';
import { defaultCampaignLifecycle } from '@/lib/marketing-jobs/campaign-lifecycle';
import {
  advanceDispatchSteps,
  buildInitialDispatchSteps,
  DISPATCH_DEPLOYMENT_STEPS,
} from '@/lib/marketing-jobs/dispatch-deployment';
import {
  buildInitialStages,
  CREATIVE_PRODUCTION_ESTIMATE_MINUTES,
  VISUAL_JOB_TOTAL_DURATION_MS,
} from '@/lib/marketing-jobs/creative-team';
import { mergeImportedAssets, parseImportedAssetsFile } from '@/lib/marketing-jobs/asset-import';
import { REQUESTED_VISUAL_ASSET_LABELS } from '@/lib/marketing-jobs/asset-catalog';
import { reconcileVisualJobStages } from '@/lib/marketing-jobs/simulation';
import type { MarketingJob, MarketingWorkspaceState } from '@/lib/marketing-jobs/types';

export type MarketingDemoStage =
  | 'idle'
  | 'team_working'
  | 'package_ready'
  | 'dispatched'
  | 'assets_ready'
  | 'operations_ready'
  | 'publishing_approved'
  | 'operations_complete';

export const MARKETING_DEMO_STAGE_LABELS: Record<MarketingDemoStage, string> = {
  idle: 'Fresh demo',
  team_working: 'AI Marketing Team working',
  package_ready: 'Campaign Package ready',
  dispatched: 'Dispatched to AI Creative Team',
  assets_ready: 'Creative Assets imported',
  operations_ready: 'Marketing Operations ready',
  publishing_approved: 'Publishing approved',
  operations_complete: 'Operations complete',
};

/** Embedded demo assets — no file upload required. */
export const DEMO_ASSETS_PAYLOAD = {
  assets: [
    {
      type: 'instagram-carousel',
      preview: 'https://placehold.co/1080x1350/e8f4ea/1d6f42?text=Thirsty+Turtl+Carousel',
      canvaUrl: 'https://www.canva.com/design/thirsty-turtl-carousel',
      downloadUrl: 'https://placehold.co/1080x1350/e8f4ea/1d6f42?text=Carousel.zip',
    },
    {
      type: 'facebook-post',
      preview: 'https://placehold.co/1200x630/e8f4ea/1d6f42?text=Thirsty+Turtl+Facebook',
      canvaUrl: 'https://www.canva.com/design/thirsty-turtl-facebook',
      downloadUrl: 'https://placehold.co/1200x630/e8f4ea/1d6f42?text=Facebook.png',
    },
    {
      type: 'pinterest-pin',
      preview: 'https://placehold.co/1000x1500/e8f4ea/1d6f42?text=Thirsty+Turtl+Pinterest',
      canvaUrl: 'https://www.canva.com/design/thirsty-turtl-pinterest',
      downloadUrl: 'https://placehold.co/1000x1500/e8f4ea/1d6f42?text=Pinterest.png',
    },
    {
      type: 'instagram-story',
      preview: 'https://placehold.co/1080x1920/e8f4ea/1d6f42?text=Thirsty+Turtl+Story',
      canvaUrl: 'https://www.canva.com/design/thirsty-turtl-story',
      downloadUrl: 'https://placehold.co/1080x1920/e8f4ea/1d6f42?text=Story.mp4',
    },
    {
      type: 'newsletter-header',
      preview: 'https://placehold.co/600x200/e8f4ea/1d6f42?text=Thirsty+Turtl+Newsletter',
      canvaUrl: 'https://www.canva.com/design/thirsty-turtl-newsletter',
      downloadUrl: 'https://placehold.co/600x200/e8f4ea/1d6f42?text=Newsletter.png',
    },
  ],
};

const TEAM_WORKING_ELAPSED_MS = 3_000;
const OPERATIONS_COMPLETE_ELAPSED_MS = 12_000;

function createVisualJobSeed(
  state: MarketingWorkspaceState,
  elapsedMs: number
): MarketingJob {
  const nowMs = Date.now();
  const createdAt = new Date(nowMs - elapsedMs).toISOString();
  const job: MarketingJob = {
    id: uuidv4(),
    companyId: state.companyId,
    campaignId: state.campaignContext.campaign.id,
    jobType: 'generate_visuals',
    status: 'queued',
    createdAt,
    updatedAt: createdAt,
    requestedAssets: [...REQUESTED_VISUAL_ASSET_LABELS],
    progress: 2,
    stages: buildInitialStages(),
    currentStageId: 'queued',
    outputs: {},
  };
  return reconcileVisualJobStages(job, nowMs);
}

function baseResetState(input: { companyId: string; companyName: string }): MarketingWorkspaceState {
  const campaignContext = buildDefaultCampaignContext(input);
  const copyJobCompletedAt = new Date(Date.now() - VISUAL_JOB_TOTAL_DURATION_MS - 60_000).toISOString();

  return {
    companyId: input.companyId,
    campaignContext,
    jobs: [
      {
        id: uuidv4(),
        companyId: input.companyId,
        campaignId: campaignContext.campaign.id,
        jobType: 'generate_copy',
        status: 'completed',
        createdAt: copyJobCompletedAt,
        updatedAt: copyJobCompletedAt,
        requestedAssets: [],
        progress: 100,
        stages: [],
        outputs: { notes: 'Thirsty Turtl demo copy package ready.' },
      },
    ],
    assets: createInitialCampaignAssets(campaignContext.campaign.id),
    creativeDispatch: {
      status: 'not_ready',
      estimatedProductionMinutes: CREATIVE_PRODUCTION_ESTIMATE_MINUTES,
      creativeProductionStatus: 'pending',
      productionPhase: 'Preparing Canva assets',
    },
    packageApproval: { status: 'none' },
    dispatchDeployment: { running: false, steps: buildInitialDispatchSteps() },
    campaignLifecycle: defaultCampaignLifecycle(),
  };
}

function withImportedAssets(state: MarketingWorkspaceState): MarketingWorkspaceState {
  const importedAt = new Date().toISOString();
  const assets = createInitialCampaignAssets(state.campaignContext.campaign.id);
  const parsed = parseImportedAssetsFile(DEMO_ASSETS_PAYLOAD);
  if (!parsed) return state;

  const result = mergeImportedAssets(assets, parsed, importedAt);
  if (!result.ok) return state;

  return {
    ...state,
    assets: result.updatedAssets,
    creativeDispatch: {
      ...state.creativeDispatch,
      status: 'dispatched',
      dispatchedAt: state.creativeDispatch.dispatchedAt ?? importedAt,
      packageFilename: 'campaign-package.zip',
      creativeProductionStatus: 'complete',
      productionPhase: 'Complete',
    },
    campaignLifecycle: {
      phase: 'ready_for_publishing',
      publishingApproval: { status: 'pending' },
      assetsReadyAt: importedAt,
    },
  };
}

export function buildDemoStateForStage(
  input: { companyId: string; companyName: string },
  stage: MarketingDemoStage
): MarketingWorkspaceState {
  if (stage === 'idle') {
    return baseResetState(input);
  }

  let state = baseResetState(input);
  const now = new Date().toISOString();
  const nowMs = Date.now();

  if (stage === 'team_working' || stage === 'package_ready' || stage === 'dispatched' || stage === 'assets_ready' || stage === 'operations_ready' || stage === 'publishing_approved' || stage === 'operations_complete') {
    const elapsed =
      stage === 'team_working'
        ? TEAM_WORKING_ELAPSED_MS
        : VISUAL_JOB_TOTAL_DURATION_MS + 500;
    const visualJob = createVisualJobSeed(state, elapsed);
    state = {
      ...state,
      jobs: [visualJob, ...state.jobs.filter((j) => j.jobType !== 'generate_visuals')],
      assets: createInitialCampaignAssets(state.campaignContext.campaign.id, visualJob.id),
      packageApproval:
        stage === 'team_working'
          ? { status: 'none' }
          : { status: 'pending' },
      creativeDispatch: {
        ...state.creativeDispatch,
        status: stage === 'team_working' ? 'not_ready' : 'ready_for_dispatch',
      },
    };
  }

  if (stage === 'dispatched' || stage === 'assets_ready' || stage === 'operations_ready' || stage === 'publishing_approved' || stage === 'operations_complete') {
    const visualJob = state.jobs.find((j) => j.jobType === 'generate_visuals')!;
    state = {
      ...state,
      packageApproval: { status: 'approved', approvedAt: now },
      creativeDispatch: {
        status: 'dispatched',
        dispatchedAt: now,
        packageFilename: 'campaign-package.zip',
        estimatedProductionMinutes: CREATIVE_PRODUCTION_ESTIMATE_MINUTES,
        creativeProductionStatus: stage === 'dispatched' ? 'in_progress' : 'complete',
        productionPhase: stage === 'dispatched' ? 'Preparing Canva assets' : 'Complete',
      },
      dispatchDeployment: {
        running: false,
        steps: advanceDispatchSteps(buildInitialDispatchSteps(), DISPATCH_DEPLOYMENT_STEPS.length),
        startedAt: now,
        completedAt: now,
      },
      jobs: state.jobs.map((j) =>
        j.id === visualJob.id
          ? {
              ...j,
              outputs: {
                ...j.outputs,
                campaignPackageExportedAt: now,
                campaignPackageFilename: 'campaign-package.zip',
              },
            }
          : j
      ),
      lastPackageExportAt: now,
    };
  }

  if (stage === 'assets_ready' || stage === 'operations_ready' || stage === 'publishing_approved' || stage === 'operations_complete') {
    state = withImportedAssets(state);
  }

  if (stage === 'publishing_approved' || stage === 'operations_complete') {
    const approvedAt = new Date(nowMs - (stage === 'operations_complete' ? OPERATIONS_COMPLETE_ELAPSED_MS : 1_000)).toISOString();
    state = {
      ...state,
      campaignLifecycle: {
        phase: stage === 'operations_complete' ? 'operations_complete' : 'publishing_approved',
        publishingApproval: { status: 'approved', approvedAt },
        assetsReadyAt: state.campaignLifecycle.assetsReadyAt,
        operationsStartedAt: approvedAt,
      },
    };
  }

  return state;
}

export function fastForwardTeamToComplete(state: MarketingWorkspaceState): MarketingWorkspaceState {
  const visualJob = state.jobs.find((j) => j.jobType === 'generate_visuals');
  if (!visualJob) return state;

  const nowMs = Date.now();
  const completedJob = reconcileVisualJobStages(
    {
      ...visualJob,
      createdAt: new Date(nowMs - VISUAL_JOB_TOTAL_DURATION_MS - 500).toISOString(),
    },
    nowMs
  );

  return {
    ...state,
    jobs: state.jobs.map((j) => (j.id === visualJob.id ? completedJob : j)),
    packageApproval: { status: 'pending' },
    creativeDispatch: { ...state.creativeDispatch, status: 'ready_for_dispatch' },
  };
}

export function fastForwardOperationsToComplete(state: MarketingWorkspaceState): MarketingWorkspaceState {
  const approvedAt = new Date(Date.now() - OPERATIONS_COMPLETE_ELAPSED_MS).toISOString();
  return {
    ...state,
    campaignLifecycle: {
      ...state.campaignLifecycle,
      phase: 'operations_complete',
      publishingApproval: { status: 'approved', approvedAt },
      operationsStartedAt: approvedAt,
    },
  };
}
