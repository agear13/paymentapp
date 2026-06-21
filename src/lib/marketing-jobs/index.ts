export type {
  AiTeamActivityEntry,
  CampaignAsset,
  CampaignAssetStatus,
  CampaignAssetType,
  CampaignPackageExport,
  CampaignPackageSummary,
  CreativeDispatchRecord,
  CreativeDispatchStatus,
  CreativeProductionStatus,
  CreativeRequirement,
  ImportedAssetRecord,
  ImportedAssetsFile,
  MarketingCampaignContext,
  MarketingJob,
  MarketingJobOutput,
  MarketingJobStage,
  MarketingJobStageStatus,
  MarketingJobStatus,
  MarketingJobType,
  MarketingWorkspaceState,
} from '@/lib/marketing-jobs/types';

export {
  AI_CREATIVE_TEAM,
  CREATIVE_PRODUCTION_ESTIMATE_MINUTES,
  VISUAL_JOB_TOTAL_DURATION_MS,
  buildInitialStages,
  getDispatchManifestItems,
  getSpecialistById,
  type AiCreativeSpecialist,
  type SpecialistIconName,
} from '@/lib/marketing-jobs/creative-team';

export {
  REQUESTED_VISUAL_ASSET_LABELS,
  VISUAL_ASSET_CATALOG,
  getCreativeRequirementsCatalog,
} from '@/lib/marketing-jobs/asset-catalog';

export {
  buildCampaignPackageExport,
  buildCampaignPackageFiles,
  buildReadmeMarkdown,
  downloadCampaignPackageZip,
} from '@/lib/marketing-jobs/campaign-package';

export {
  mergeImportedAssets,
  parseImportedAssetsFile,
  readAssetsJsonFile,
} from '@/lib/marketing-jobs/asset-import';

export {
  campaignAssetStatusLabel,
  marketingJobStatusLabel,
  marketingJobTypeLabel,
} from '@/lib/marketing-jobs/labels';

export {
  MarketingJobEngine,
  buildCampaignPackageSummary,
  buildDashboardActivity,
  disposeMarketingJobEngine,
  getOrCreateMarketingJobEngine,
  selectReadyAssetCount,
  selectVisualGenerationJob,
} from '@/lib/marketing-jobs/job-engine';

export {
  buildAiTeamActivity,
  getActiveStageLabel,
  isVisualJobInFlight,
  isVisualJobReadyForDispatch,
  reconcileVisualJobStages,
} from '@/lib/marketing-jobs/simulation';

export {
  buildActivityFeed,
  buildAiTeamPerformance,
  buildAiTeamReport,
  buildApprovalSummary,
  buildCampaignCompletion,
  buildCampaignStatus,
  buildClientReport,
  buildPackageHealthView,
  buildProductionFeedMessages,
  buildSpecialistPipeline,
  downloadReportJson,
  getSpecialistDetail,
} from '@/lib/marketing-jobs/command-centre';

export {
  OPERATIONS_STAGE_OFFSETS,
  PUBLICATION_SCHEDULE,
  buildCampaignInsights,
  buildDistributionPipeline,
  buildLifecycleTimeline,
  buildMarketingRoadmap,
  buildNextCampaignRecommendation,
  buildOperationsCompletionMetrics,
  buildOperationsPublishingCard,
  buildPublicationScheduleView,
  defaultCampaignLifecycle,
  isCreativeAssetsReady,
  resolveOperationsPhase,
} from '@/lib/marketing-jobs/campaign-lifecycle';

export {
  NEXT_CAMPAIGN_RECOMMENDATION,
  buildRecommendedCampaignContext,
} from '@/lib/marketing-jobs/campaign-recommendations';

export {
  PRODUCTION_DOCUMENT_DEFINITIONS,
  TOTAL_PACKAGE_FILES,
  buildProductionDocuments,
  computePackageHealth,
} from '@/lib/marketing-jobs/production-documents';

export {
  DISPATCH_DEPLOYMENT_STEPS,
  advanceDispatchSteps,
  buildInitialDispatchSteps,
} from '@/lib/marketing-jobs/dispatch-deployment';

export type {
  ActivityFeedEntry,
  AiTeamPerformanceMetrics,
  CampaignCompletionSummary,
  CampaignInsightsProjection,
  CampaignStatusSnapshot,
  DispatchDeploymentRecord,
  DispatchDeploymentStep,
  DistributionPipelineStage,
  LifecycleMilestone,
  MarketingCampaignLifecycle,
  MarketingOperationsPhase,
  MarketingRoadmapItem,
  NextCampaignRecommendation,
  OperationsPublishingCardView,
  PackageApprovalRecord,
  PackageHealthView,
  ProductionDocument,
  ProductionDocumentStatus,
  PublicationScheduleItem,
  PublishingApprovalRecord,
  SpecialistDisplayStatus,
  SpecialistPipelineEntry,
} from '@/lib/marketing-jobs/types';

export { MARKETING_DEMO_BRAND, MARKETING_DEMO_TAGLINE } from '@/lib/marketing-jobs/demo-brand';

export {
  buildDemoStateForStage,
  DEMO_ASSETS_PAYLOAD,
  fastForwardOperationsToComplete,
  fastForwardTeamToComplete,
  MARKETING_DEMO_STAGE_LABELS,
  type MarketingDemoStage,
} from '@/lib/marketing-jobs/demo-mode';

export { getMarketingLoadingCopy, type MarketingLoadingContext } from '@/lib/marketing-jobs/loading-copy';

export { marketingToasts } from '@/lib/marketing-jobs/notifications';

export { MARKETING_JOBS_RECONCILE_INTERVAL_MS } from '@/lib/marketing-jobs/constants';
