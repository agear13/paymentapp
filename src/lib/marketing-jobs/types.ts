import type { SpecialistIconName } from '@/lib/marketing-jobs/creative-team';

/** Canonical marketing job types — extend via configuration, not architecture changes. */
export type MarketingJobType = 'generate_visuals' | 'generate_video' | 'generate_copy';

/** Internal job status — UI should prefer `stages` for specialist workflow display. */
export type MarketingJobStatus =
  | 'queued'
  | 'generating'
  | 'reviewing'
  | 'completed'
  | 'failed';

export type MarketingJobStageStatus = 'pending' | 'active' | 'completed';

/** UI-facing specialist status for command centre. */
export type SpecialistDisplayStatus = 'waiting' | 'working' | 'completed';

export type ProductionDocumentStatus = 'waiting' | 'generating' | 'complete';

export type ProductionDocument = {
  id: string;
  label: string;
  specialistId: string;
  status: ProductionDocumentStatus;
};

export type PackageApprovalStatus = 'none' | 'pending' | 'approved';

export type PackageApprovalRecord = {
  status: PackageApprovalStatus;
  approvedAt?: string;
};

export type DispatchStepStatus = 'pending' | 'active' | 'complete';

export type DispatchDeploymentStep = {
  id: string;
  label: string;
  status: DispatchStepStatus;
};

export type DispatchDeploymentRecord = {
  running: boolean;
  steps: DispatchDeploymentStep[];
  startedAt?: string;
  completedAt?: string;
};

export type SpecialistPipelineEntry = {
  id: string;
  role: string;
  name: string;
  status: SpecialistDisplayStatus;
  currentTask: string;
  progress: number;
  completedAt?: string;
  confidence: number;
  icon: SpecialistIconName;
};

export type ActivityFeedEntry = {
  id: string;
  specialistId: string;
  role: string;
  message: string;
  status: SpecialistDisplayStatus;
  timestamp?: string;
};

export type CampaignStatusSnapshot = {
  phase: 'idle' | 'team_working' | 'awaiting_approval' | 'dispatching' | 'creative_production' | 'completed';
  headline: string;
  detail: string;
  progress: number;
};

export type PackageHealthView = {
  filesGenerated: number;
  totalFiles: number;
  healthPercent: number;
  readyForDispatch: boolean;
  documents: ProductionDocument[];
};

export type AiTeamPerformanceMetrics = {
  businessKnowledgeCoverage: number;
  brandCompliance: number;
  contentQuality: number;
  creativeReadiness: number;
  marketingConfidence: number;
  overallPerformance: number;
  estimatedHumanTimeSavedHours: number;
  assetsProduced: number;
  recommendationsGenerated: number;
  knowledgeGapsIdentified: number;
};

export type CampaignCompletionSummary = {
  creativeAssetsProduced: number;
  visualAssets: number;
  canvaDesigns: number;
  campaignDocuments: number;
  productionTimeMinutes: number;
  qualityAssurance: 'Passed' | 'Pending';
  brandCompliance: number;
  knowledgeCoverage: number;
  aiSpecialists: number;
  estimatedTimeSavedHours: number;
  clientReportReady: boolean;
  aiTeamReportReady: boolean;
  campaignStatus: string;
};

/** Post-creative operations phase — advances after publishing approval. */
export type MarketingOperationsPhase =
  | 'inactive'
  | 'ready_for_publishing'
  | 'publishing_approved'
  | 'scheduled'
  | 'awaiting_results'
  | 'performance_review'
  | 'operations_complete';

export type PublishingApprovalStatus = 'none' | 'pending' | 'approved';

export type PublishingApprovalRecord = {
  status: PublishingApprovalStatus;
  approvedAt?: string;
};

/** Canonical campaign lifecycle — single workflow state for operations layer. */
export type MarketingCampaignLifecycle = {
  phase: MarketingOperationsPhase;
  publishingApproval: PublishingApprovalRecord;
  assetsReadyAt?: string;
  /** Anchor for deterministic post-approval distribution timeline. */
  operationsStartedAt?: string;
};

export type DistributionStageStatus = 'pending' | 'active' | 'complete';

export type DistributionPipelineStage = {
  id: string;
  label: string;
  description: string;
  status: DistributionStageStatus;
  timestamp?: string;
  nextAction?: string;
};

export type LifecycleMilestoneStatus = 'complete' | 'pending' | 'waiting';

export type LifecycleMilestone = {
  id: string;
  label: string;
  status: LifecycleMilestoneStatus;
  completedAt?: string;
};

export type PublicationScheduleItem = {
  id: string;
  channel: string;
  day: string;
  time: string;
};

export type CampaignInsightsProjection = {
  expectedOrganicReach: number;
  expectedWebsiteVisits: number;
  estimatedLeads: number;
  estimatedProductionSavingHours: number;
  knowledgeGapsIdentified: number;
  recommendations: number;
};

export type NextCampaignRecommendation = {
  id: string;
  topic: string;
  reasons: string[];
  estimatedOrganicTraffic: number;
  estimatedAssets: number;
  estimatedProductionMinutes: number;
  businessGoal: string;
};

export type MarketingRoadmapItemStatus =
  | 'completed'
  | 'pending_approval'
  | 'upcoming'
  | 'recommended';

export type MarketingRoadmapItem = {
  id: string;
  label: string;
  status: MarketingRoadmapItemStatus;
};

export type OperationsPublishingCardView = {
  campaignStatus: string;
  creativeAssetsComplete: number;
  clientApprovalStatus: string;
  distributionStatus: string;
  showApproveCta: boolean;
  showSchedule: boolean;
};

export type MarketingJobStage = {
  specialistId: string;
  title: string;
  description: string;
  icon: SpecialistIconName;
  status: MarketingJobStageStatus;
  completedAt?: string;
};

export type CampaignAssetStatus = 'queued' | 'generating' | 'ready';

export type CampaignAssetType =
  | 'instagram-carousel'
  | 'facebook-post'
  | 'pinterest-pin'
  | 'instagram-story'
  | 'newsletter-header';

export type CreativeDispatchStatus =
  | 'not_ready'
  | 'ready_for_dispatch'
  | 'dispatched';

export type CreativeProductionStatus = 'pending' | 'in_progress' | 'complete';

export type CreativeDispatchRecord = {
  status: CreativeDispatchStatus;
  dispatchedAt?: string;
  packageFilename?: string;
  estimatedProductionMinutes: number;
  creativeProductionStatus: CreativeProductionStatus;
  productionPhase?: string;
};

/** Output slot populated when a job completes (package export, metadata, etc.). */
export type MarketingJobOutput = {
  campaignPackageExportedAt?: string;
  campaignPackageFilename?: string;
  notes?: string;
};

export type MarketingJob = {
  id: string;
  companyId: string;
  campaignId: string;
  jobType: MarketingJobType;
  status: MarketingJobStatus;
  createdAt: string;
  updatedAt: string;
  requestedAssets: string[];
  progress: number;
  stages: MarketingJobStage[];
  currentStageId?: string;
  outputs: MarketingJobOutput;
  errorMessage?: string;
};

export type CampaignAsset = {
  id: string;
  campaignId: string;
  type: CampaignAssetType;
  label: string;
  status: CampaignAssetStatus;
  previewUrl?: string;
  canvaUrl?: string;
  downloadUrl?: string;
  importedAt?: string;
  jobId?: string;
};

export type MarketingCompanyBrainSnapshot = {
  knowledgeFile: string;
  brandVoice: string;
  personas: string;
  messaging: string;
  positioning?: string;
  products?: string;
};

export type MarketingCampaignSnapshot = {
  id: string;
  title: string;
  type: string;
  businessGoal: string;
  targetAudience: string;
};

export type MarketingCampaignContext = {
  company: { name: string };
  campaign: MarketingCampaignSnapshot;
  companyBrain: MarketingCompanyBrainSnapshot;
  article: {
    title: string;
    summary: string;
    outline: string[];
  };
  copy: {
    headline: string;
    subheadline: string;
    cta: string;
    socialCaption: string;
    newsletterIntro: string;
  };
  seo: {
    primaryKeyword: string;
    secondaryKeywords: string[];
    metaDescription: string;
  };
  visualRecommendations: Record<
    string,
    {
      format: string;
      dimensions: string;
      concept: string;
      notes: string;
    }
  >;
};

export type MarketingWorkspaceState = {
  companyId: string;
  campaignContext: MarketingCampaignContext;
  jobs: MarketingJob[];
  assets: CampaignAsset[];
  /** @deprecated use creativeDispatch.dispatchedAt */
  lastPackageExportAt?: string;
  creativeDispatch: CreativeDispatchRecord;
  packageApproval: PackageApprovalRecord;
  dispatchDeployment: DispatchDeploymentRecord;
  campaignLifecycle: MarketingCampaignLifecycle;
};

export type ImportedAssetRecord = {
  type: string;
  preview?: string;
  canvaUrl?: string;
  downloadUrl?: string;
};

export type ImportedAssetsFile = {
  assets: ImportedAssetRecord[];
};

export type CampaignPackageExport = {
  company: { name: string };
  campaign: { title: string };
  companyBrain: MarketingCompanyBrainSnapshot;
  article: MarketingCampaignContext['article'];
  copy: MarketingCampaignContext['copy'];
  seo: MarketingCampaignContext['seo'];
  visualRecommendations: MarketingCampaignContext['visualRecommendations'];
  requestedAssets: string[];
  exportedAt: string;
  jobId: string;
};

export type CreativeRequirement = {
  assetType: CampaignAssetType;
  label: string;
  requirements: string[];
  canvaReady: boolean;
};

export type AiTeamActivityEntry = {
  id: string;
  specialistId: string;
  role: string;
  title: string;
  description: string;
  icon: SpecialistIconName;
  completedAt?: string;
  status: MarketingJobStageStatus;
};

export type CampaignPackageSummary = {
  status: 'ready' | 'pending';
  dispatchStatus: CreativeDispatchStatus;
  contains: string[];
  creativeProductionStatus: CreativeProductionStatus;
  estimatedDurationMinutes: number;
};
