import { v4 as uuidv4 } from 'uuid';
import {
  createInitialCampaignAssets,
  REQUESTED_VISUAL_ASSET_LABELS,
} from '@/lib/marketing-jobs/asset-catalog';
import { mergeImportedAssets, parseImportedAssetsFile } from '@/lib/marketing-jobs/asset-import';
import { syncAssetsWithVisualJob } from '@/lib/marketing-jobs/asset-sync';
import { buildDefaultCampaignContext } from '@/lib/marketing-jobs/campaign-context';
import {
  defaultCampaignLifecycle,
  isCreativeAssetsReady,
  resolveOperationsPhase,
} from '@/lib/marketing-jobs/campaign-lifecycle';
import {
  buildDemoStateForStage,
  DEMO_ASSETS_PAYLOAD,
  fastForwardOperationsToComplete,
  fastForwardTeamToComplete,
  type MarketingDemoStage,
} from '@/lib/marketing-jobs/demo-mode';
import {
  buildNextCampaignRecommendation,
  buildRecommendedCampaignContext,
} from '@/lib/marketing-jobs/campaign-recommendations';
import {
  buildCampaignPackageFiles,
  downloadCampaignPackageZip,
} from '@/lib/marketing-jobs/campaign-package';
import {
  buildClientReport,
  buildAiTeamReport,
  downloadReportJson,
} from '@/lib/marketing-jobs/command-centre';
import {
  advanceDispatchSteps,
  buildInitialDispatchSteps,
  DISPATCH_DEPLOYMENT_STEPS,
} from '@/lib/marketing-jobs/dispatch-deployment';
import {
  buildInitialStages,
  CREATIVE_PRODUCTION_ESTIMATE_MINUTES,
  DISPATCH_DEPLOYMENT_STEP_MS,
  getMarketingLeadSpecialist,
  VISUAL_JOB_TOTAL_DURATION_MS,
} from '@/lib/marketing-jobs/creative-team';
import { MARKETING_JOBS_RECONCILE_INTERVAL_MS } from '@/lib/marketing-jobs/constants';
import {
  isVisualJobInFlight,
  isVisualJobReadyForDispatch,
  reconcileVisualJobStages,
} from '@/lib/marketing-jobs/simulation';
import { createLocalMarketingJobStore, type MarketingJobStore } from '@/lib/marketing-jobs/store';
import type {
  CampaignAsset,
  CampaignPackageSummary,
  CreativeDispatchRecord,
  DispatchDeploymentRecord,
  MarketingCampaignLifecycle,
  MarketingJob,
  MarketingWorkspaceState,
  PackageApprovalRecord,
} from '@/lib/marketing-jobs/types';

export type CreateMarketingJobEngineInput = {
  companyId: string;
  companyName: string;
};

function defaultCampaignLifecycleState(): MarketingCampaignLifecycle {
  return defaultCampaignLifecycle();
}

function defaultCreativeDispatch(): CreativeDispatchRecord {
  return {
    status: 'not_ready',
    estimatedProductionMinutes: CREATIVE_PRODUCTION_ESTIMATE_MINUTES,
    creativeProductionStatus: 'pending',
    productionPhase: 'Preparing Canva assets',
  };
}

function defaultPackageApproval(): PackageApprovalRecord {
  return { status: 'none' };
}

function defaultDispatchDeployment(): DispatchDeploymentRecord {
  return { running: false, steps: buildInitialDispatchSteps() };
}

function normalizeWorkspaceState(state: MarketingWorkspaceState): MarketingWorkspaceState {
  return {
    ...state,
    creativeDispatch: {
      ...defaultCreativeDispatch(),
      ...state.creativeDispatch,
    },
    packageApproval: state.packageApproval ?? defaultPackageApproval(),
    dispatchDeployment: state.dispatchDeployment ?? defaultDispatchDeployment(),
    campaignLifecycle: {
      ...defaultCampaignLifecycleState(),
      ...state.campaignLifecycle,
      publishingApproval: {
        ...defaultCampaignLifecycleState().publishingApproval,
        ...state.campaignLifecycle?.publishingApproval,
      },
    },
    jobs: state.jobs.map((job) => ({
      ...job,
      stages: job.stages?.length ? job.stages : buildInitialStages(),
    })),
    campaignContext: {
      ...state.campaignContext,
      seo: state.campaignContext.seo ?? {
        primaryKeyword: 'campaign keyword',
        secondaryKeywords: [],
        metaDescription: state.campaignContext.article.summary,
      },
      companyBrain: {
        ...state.campaignContext.companyBrain,
        positioning: state.campaignContext.companyBrain.positioning ?? '',
        products: state.campaignContext.companyBrain.products ?? '',
      },
    },
  };
}

export class MarketingJobEngine {
  private store: MarketingJobStore;
  private reconcileTimer: ReturnType<typeof setInterval> | null = null;
  private dispatchTimer: ReturnType<typeof setInterval> | null = null;
  private readonly companyName: string;

  constructor(input: CreateMarketingJobEngineInput) {
    this.companyName = input.companyName;
    const campaignContext = buildDefaultCampaignContext({
      companyId: input.companyId,
      companyName: input.companyName,
    });

    const initialState = buildInitialWorkspaceState(input.companyId, campaignContext);
    this.store = createLocalMarketingJobStore(initialState);
    this.store.setState(normalizeWorkspaceState(this.store.getState()));
    this.reconcile();
    this.startReconciler();
  }

  subscribe(listener: (state: MarketingWorkspaceState) => void): () => void {
    return this.store.subscribe(listener);
  }

  getState(): MarketingWorkspaceState {
    return this.store.getState();
  }

  dispose(): void {
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    if (this.dispatchTimer) clearInterval(this.dispatchTimer);
    this.reconcileTimer = null;
    this.dispatchTimer = null;
  }

  createVisualGenerationJob(): MarketingJob {
    const state = this.store.getState();
    const inFlight = state.jobs.some(isVisualJobInFlight);
    if (inFlight) {
      throw new Error('AI Marketing Team is already working on this campaign.');
    }

    const now = new Date().toISOString();
    const job: MarketingJob = {
      id: uuidv4(),
      companyId: state.companyId,
      campaignId: state.campaignContext.campaign.id,
      jobType: 'generate_visuals',
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      requestedAssets: [...REQUESTED_VISUAL_ASSET_LABELS],
      progress: 2,
      stages: buildInitialStages(),
      currentStageId: 'queued',
      outputs: {},
    };

    const assets = createInitialCampaignAssets(state.campaignContext.campaign.id, job.id);
    const nextJobs = [
      job,
      ...state.jobs.filter((existing) => existing.jobType !== 'generate_visuals'),
    ];

    this.store.setState({
      ...state,
      jobs: nextJobs,
      assets,
      creativeDispatch: defaultCreativeDispatch(),
      packageApproval: defaultPackageApproval(),
      dispatchDeployment: defaultDispatchDeployment(),
      campaignLifecycle: defaultCampaignLifecycleState(),
      lastPackageExportAt: undefined,
    });

    return job;
  }

  returnPackageForRevision(): void {
    const state = this.store.getState();
    const job = state.jobs.find((item) => item.jobType === 'generate_visuals');
    if (!job) throw new Error('No campaign package to revise.');

    const lead = getMarketingLeadSpecialist();
    const prevSpecialistOffset = lead.offsetMs - 400;

    const nowMs = Date.now();
    const resetCreatedAt = new Date(nowMs - prevSpecialistOffset).toISOString();

    const jobs = state.jobs.map((item) =>
      item.jobType === 'generate_visuals'
        ? {
            ...item,
            status: 'reviewing' as const,
            progress: lead.progress - 8,
            createdAt: resetCreatedAt,
            updatedAt: new Date().toISOString(),
            currentStageId: lead.id,
          }
        : item
    );

    this.store.setState({
      ...state,
      jobs,
      packageApproval: defaultPackageApproval(),
      creativeDispatch: {
        ...state.creativeDispatch,
        status: 'not_ready',
      },
      dispatchDeployment: defaultDispatchDeployment(),
    });

    this.reconcile();
  }

  approveAndDispatch(jobId?: string): void {
    const state = this.store.getState();
    const job =
      (jobId ? state.jobs.find((item) => item.id === jobId) : null) ??
      state.jobs.find((item) => item.jobType === 'generate_visuals');

    if (!job) throw new Error('No campaign package available.');
    if (!isVisualJobReadyForDispatch(job)) {
      throw new Error('Campaign package is not ready for approval yet.');
    }
    if (state.dispatchDeployment.running) return;

    const approvedAt = new Date().toISOString();
    this.store.setState({
      ...state,
      packageApproval: { status: 'approved', approvedAt },
      dispatchDeployment: {
        running: true,
        steps: buildInitialDispatchSteps(),
        startedAt: approvedAt,
      },
    });

    this.runDispatchDeployment(job.id);
  }

  /** @deprecated Use approveAndDispatch */
  dispatchToCreativeTeam(jobId?: string): void {
    this.approveAndDispatch(jobId);
  }

  downloadClientReport(): void {
    downloadReportJson('client-report.json', buildClientReport(this.store.getState()));
  }

  downloadAiTeamReport(): void {
    downloadReportJson('ai-team-report.json', buildAiTeamReport(this.store.getState()));
  }

  approveForPublishing(): void {
    const state = this.store.getState();
    if (!isCreativeAssetsReady(state)) {
      throw new Error('Creative assets must be imported before publishing approval.');
    }
    if (state.campaignLifecycle.publishingApproval.status === 'approved') {
      return;
    }

    const approvedAt = new Date().toISOString();
    this.store.setState({
      ...state,
      campaignLifecycle: {
        ...state.campaignLifecycle,
        phase: 'publishing_approved',
        publishingApproval: { status: 'approved', approvedAt },
        operationsStartedAt: approvedAt,
      },
    });
  }

  downloadCampaignPackage(): void {
    const state = this.store.getState();
    const job = state.jobs.find((item) => item.jobType === 'generate_visuals');
    if (!job) throw new Error('No campaign package available.');

    const exportedAt = new Date().toISOString();
    const files = buildCampaignPackageFiles({
      context: state.campaignContext,
      jobId: job.id,
      exportedAt,
    });
    downloadCampaignPackageZip(files);
  }

  generateRecommendedCampaign(): MarketingJob {
    const state = this.store.getState();
    const recommendation = buildNextCampaignRecommendation();
    const campaignContext = buildRecommendedCampaignContext(
      { companyId: state.companyId, companyName: this.companyName },
      recommendation
    );

    this.store.setState({
      ...state,
      campaignContext,
      jobs: state.jobs.filter((job) => job.jobType !== 'generate_visuals'),
      assets: createInitialCampaignAssets(campaignContext.campaign.id),
      creativeDispatch: defaultCreativeDispatch(),
      packageApproval: defaultPackageApproval(),
      dispatchDeployment: defaultDispatchDeployment(),
      campaignLifecycle: defaultCampaignLifecycleState(),
      lastPackageExportAt: undefined,
    });

    return this.createVisualGenerationJob();
  }

  importGeneratedAssets(raw: unknown): { importedCount: number } {
    const parsed = parseImportedAssetsFile(raw);
    if (!parsed) {
      throw new Error('Invalid assets.json format. Expected an object with an assets array.');
    }

    const state = this.store.getState();
    const importedAt = new Date().toISOString();
    const result = mergeImportedAssets(state.assets, parsed, importedAt);

    if (!result.ok) {
      throw new Error(result.error);
    }

    const readyCount = result.updatedAssets.filter((asset) => asset.status === 'ready').length;
    const allReady = readyCount === result.updatedAssets.length;

    const nextLifecycle =
      allReady && state.campaignLifecycle.phase === 'inactive'
        ? {
            ...state.campaignLifecycle,
            phase: 'ready_for_publishing' as const,
            assetsReadyAt: importedAt,
            publishingApproval: { status: 'pending' as const },
          }
        : state.campaignLifecycle;

    this.store.setState({
      ...state,
      assets: result.updatedAssets,
      creativeDispatch: {
        ...state.creativeDispatch,
        creativeProductionStatus: allReady
          ? 'complete'
          : readyCount > 0
            ? 'in_progress'
            : state.creativeDispatch.creativeProductionStatus,
        productionPhase: allReady ? 'Complete' : 'Importing assets',
      },
      campaignLifecycle: nextLifecycle,
    });

    return { importedCount: result.importedCount };
  }

  resetMarketingDemo(): void {
    if (this.dispatchTimer) clearInterval(this.dispatchTimer);
    this.dispatchTimer = null;
    const state = this.store.getState();
    this.store.setState(
      normalizeWorkspaceState(
        buildDemoStateForStage(
          { companyId: state.companyId, companyName: this.companyName },
          'idle'
        )
      )
    );
    this.reconcile();
  }

  jumpToDemoStage(stage: MarketingDemoStage): void {
    if (this.dispatchTimer) clearInterval(this.dispatchTimer);
    this.dispatchTimer = null;
    const state = this.store.getState();
    this.store.setState(
      normalizeWorkspaceState(
        buildDemoStateForStage(
          { companyId: state.companyId, companyName: this.companyName },
          stage
        )
      )
    );
    this.reconcile();
  }

  importDemoAssets(): { importedCount: number } {
    return this.importGeneratedAssets(DEMO_ASSETS_PAYLOAD);
  }

  fastForwardMarketingTeam(): void {
    const state = this.store.getState();
    let next = state;
    const visualJob = state.jobs.find((j) => j.jobType === 'generate_visuals');
    if (!visualJob) {
      this.createVisualGenerationJob();
      next = this.store.getState();
    }
    this.store.setState(normalizeWorkspaceState(fastForwardTeamToComplete(next)));
    this.reconcile();
  }

  demoApprovePackage(): void {
    this.fastForwardMarketingTeam();
    const state = this.store.getState();
    const approvedAt = new Date().toISOString();
    this.store.setState({
      ...state,
      packageApproval: { status: 'approved', approvedAt },
    });
  }

  demoDispatchSkipAnimation(): void {
    this.demoApprovePackage();
    const state = this.store.getState();
    const job = state.jobs.find((j) => j.jobType === 'generate_visuals');
    if (!job) return;
    const dispatchedAt = new Date().toISOString();
    this.store.setState({
      ...state,
      creativeDispatch: {
        status: 'dispatched',
        dispatchedAt,
        packageFilename: 'campaign-package.zip',
        estimatedProductionMinutes: CREATIVE_PRODUCTION_ESTIMATE_MINUTES,
        creativeProductionStatus: 'in_progress',
        productionPhase: 'Preparing Canva assets',
      },
      dispatchDeployment: {
        running: false,
        steps: advanceDispatchSteps(buildInitialDispatchSteps(), DISPATCH_DEPLOYMENT_STEPS.length),
        startedAt: dispatchedAt,
        completedAt: dispatchedAt,
      },
      lastPackageExportAt: dispatchedAt,
    });
  }

  fastForwardMarketingOperations(): void {
    let state = this.store.getState();
    if (!isCreativeAssetsReady(state)) {
      this.demoDispatchSkipAnimation();
      this.importDemoAssets();
      state = this.store.getState();
    }
    if (state.campaignLifecycle.publishingApproval.status !== 'approved') {
      this.approveForPublishing();
      state = this.store.getState();
    }
    this.store.setState(normalizeWorkspaceState(fastForwardOperationsToComplete(state)));
    this.reconcile();
  }

  replayMarketingDemo(): void {
    this.resetMarketingDemo();
    this.createVisualGenerationJob();
  }

  private runDispatchDeployment(jobId: string): void {
    let stepIndex = 0;
    const totalSteps = DISPATCH_DEPLOYMENT_STEPS.length;

    if (this.dispatchTimer) clearInterval(this.dispatchTimer);

    this.dispatchTimer = setInterval(() => {
      const state = this.store.getState();
      const steps = advanceDispatchSteps(state.dispatchDeployment.steps, stepIndex);

      this.store.setState({
        ...state,
        dispatchDeployment: {
          ...state.dispatchDeployment,
          steps,
        },
      });

      stepIndex += 1;

      if (stepIndex > totalSteps) {
        if (this.dispatchTimer) clearInterval(this.dispatchTimer);
        this.dispatchTimer = null;
        this.finalizeDispatch(jobId);
      }
    }, DISPATCH_DEPLOYMENT_STEP_MS);
  }

  private finalizeDispatch(jobId: string): void {
    const state = this.store.getState();
    const job = state.jobs.find((item) => item.id === jobId);
    if (!job) return;

    const dispatchedAt = new Date().toISOString();
    const files = buildCampaignPackageFiles({
      context: state.campaignContext,
      jobId: job.id,
      exportedAt: dispatchedAt,
    });

    downloadCampaignPackageZip(files);

    const jobs = state.jobs.map((item) =>
      item.id === job.id
        ? {
            ...item,
            outputs: {
              ...item.outputs,
              campaignPackageExportedAt: dispatchedAt,
              campaignPackageFilename: 'campaign-package.zip',
            },
            updatedAt: dispatchedAt,
          }
        : item
    );

    this.store.setState({
      ...state,
      jobs,
      creativeDispatch: {
        status: 'dispatched',
        dispatchedAt,
        packageFilename: 'campaign-package.zip',
        estimatedProductionMinutes: CREATIVE_PRODUCTION_ESTIMATE_MINUTES,
        creativeProductionStatus: 'in_progress',
        productionPhase: 'Preparing Canva assets',
      },
      dispatchDeployment: {
        running: false,
        steps: advanceDispatchSteps(buildInitialDispatchSteps(), DISPATCH_DEPLOYMENT_STEPS.length),
        startedAt: state.dispatchDeployment.startedAt,
        completedAt: dispatchedAt,
      },
      lastPackageExportAt: dispatchedAt,
    });
  }

  private startReconciler(): void {
    this.reconcileTimer = setInterval(() => {
      this.reconcile();
    }, MARKETING_JOBS_RECONCILE_INTERVAL_MS);
  }

  private reconcile(): void {
    const state = normalizeWorkspaceState(this.store.getState());
    const nowMs = Date.now();

    let changed = false;
    let assets = state.assets;
    let creativeDispatch = state.creativeDispatch;
    let packageApproval = state.packageApproval;
    let campaignLifecycle = resolveOperationsPhase(state.campaignLifecycle, nowMs);

    const jobs = state.jobs.map((job) => {
      if (job.jobType !== 'generate_visuals') return job;
      const reconciled = reconcileVisualJobStages(job, nowMs);
      if (reconciled !== job) changed = true;

      if (
        isVisualJobReadyForDispatch(reconciled) &&
        creativeDispatch.status === 'not_ready'
      ) {
        creativeDispatch = { ...creativeDispatch, status: 'ready_for_dispatch' };
        changed = true;
      }

      if (
        isVisualJobReadyForDispatch(reconciled) &&
        packageApproval.status === 'none'
      ) {
        packageApproval = { status: 'pending' };
        changed = true;
      }

      const syncedAssets = syncAssetsWithVisualJob(assets, reconciled);
      if (syncedAssets !== assets) {
        assets = syncedAssets;
        changed = true;
      }
      return reconciled;
    });

    if (!changed && campaignLifecycle === state.campaignLifecycle) return;

    if (campaignLifecycle !== state.campaignLifecycle) changed = true;

    this.store.setState({
      ...state,
      jobs,
      assets,
      creativeDispatch,
      packageApproval,
      campaignLifecycle,
    });
  }
}

function buildInitialWorkspaceState(
  companyId: string,
  campaignContext: MarketingWorkspaceState['campaignContext']
): MarketingWorkspaceState {
  const copyJobCompletedAt = new Date(Date.now() - VISUAL_JOB_TOTAL_DURATION_MS - 60_000).toISOString();

  const demoCopyJob: MarketingJob = {
    id: uuidv4(),
    companyId,
    campaignId: campaignContext.campaign.id,
    jobType: 'generate_copy',
    status: 'completed',
    createdAt: copyJobCompletedAt,
    updatedAt: copyJobCompletedAt,
    requestedAssets: [],
    progress: 100,
    stages: [],
    outputs: {
      notes: 'Demo copy package ready for campaign hand-off.',
    },
  };

  return normalizeWorkspaceState({
    companyId,
    campaignContext,
    jobs: [demoCopyJob],
    assets: createInitialCampaignAssets(campaignContext.campaign.id),
    creativeDispatch: defaultCreativeDispatch(),
    packageApproval: defaultPackageApproval(),
    dispatchDeployment: defaultDispatchDeployment(),
    campaignLifecycle: defaultCampaignLifecycleState(),
  });
}

const engineRegistry = new Map<string, MarketingJobEngine>();

export function getOrCreateMarketingJobEngine(input: CreateMarketingJobEngineInput): MarketingJobEngine {
  const existing = engineRegistry.get(input.companyId);
  if (existing) return existing;

  const engine = new MarketingJobEngine(input);
  engineRegistry.set(input.companyId, engine);
  return engine;
}

export function disposeMarketingJobEngine(companyId: string): void {
  const engine = engineRegistry.get(companyId);
  engine?.dispose();
  engineRegistry.delete(companyId);
}

export function selectVisualGenerationJob(jobs: MarketingJob[]): MarketingJob | null {
  return jobs.find((job) => job.jobType === 'generate_visuals') ?? null;
}

export function selectReadyAssetCount(assets: CampaignAsset[]): number {
  return assets.filter((asset) => asset.status === 'ready').length;
}

export function buildCampaignPackageSummary(state: MarketingWorkspaceState): CampaignPackageSummary {
  const visualJob = selectVisualGenerationJob(state.jobs);
  const ready = visualJob?.status === 'completed';

  return {
    status: ready ? 'ready' : 'pending',
    dispatchStatus: state.creativeDispatch.status,
    contains: [
      'Company Brain',
      'Campaign Strategy',
      'SEO Content',
      'Social Copy',
      'Visual Brief',
      'Asset Checklist',
    ],
    creativeProductionStatus: state.creativeDispatch.creativeProductionStatus,
    estimatedDurationMinutes: state.creativeDispatch.estimatedProductionMinutes,
  };
}

export function buildDashboardActivity(state: MarketingWorkspaceState): Array<{
  id: string;
  label: string;
  completed: boolean;
}> {
  const visualJob = selectVisualGenerationJob(state.jobs);
  const readyCount = selectReadyAssetCount(state.assets);

  return [
    {
      id: 'company-brain',
      label: 'Company Brain completed',
      completed: true,
    },
    {
      id: 'visual-job',
      label: visualJob
        ? `AI Marketing Team — ${visualJob.status === 'completed' ? 'package ready' : visualJob.currentStageId ?? visualJob.status}`
        : 'AI Marketing Team not started',
      completed: visualJob?.status === 'completed',
    },
    {
      id: 'package-approval',
      label:
        state.packageApproval.status === 'approved'
          ? 'Package approved'
          : state.packageApproval.status === 'pending'
            ? 'Awaiting package approval'
            : 'Package approval pending',
      completed: state.packageApproval.status === 'approved',
    },
    {
      id: 'package-dispatch',
      label:
        state.creativeDispatch.status === 'dispatched'
          ? 'Dispatched to AI Creative Team'
          : 'Awaiting creative dispatch',
      completed: state.creativeDispatch.status === 'dispatched',
    },
    {
      id: 'assets-import',
      label: readyCount > 0 ? `${readyCount} assets imported` : 'Awaiting asset import',
      completed: readyCount > 0,
    },
    {
      id: 'publishing-approval',
      label:
        state.campaignLifecycle.publishingApproval.status === 'approved'
          ? 'Publishing approved'
          : state.campaignLifecycle.publishingApproval.status === 'pending'
            ? 'Awaiting publishing approval'
            : 'Publishing not started',
      completed: state.campaignLifecycle.publishingApproval.status === 'approved',
    },
    {
      id: 'operations-complete',
      label:
        state.campaignLifecycle.phase === 'operations_complete'
          ? 'Marketing operations complete'
          : 'Marketing operations in progress',
      completed: state.campaignLifecycle.phase === 'operations_complete',
    },
    {
      id: 'copy-job',
      label: 'Copy generation completed',
      completed: state.jobs.some(
        (job) => job.jobType === 'generate_copy' && job.status === 'completed'
      ),
    },
  ];
}
