import type { CampaignAsset, MarketingJobStatus, MarketingJobType } from '@/lib/marketing-jobs/types';

export function marketingJobTypeLabel(jobType: MarketingJobType): string {
  switch (jobType) {
    case 'generate_visuals':
      return 'Visual Generation';
    case 'generate_video':
      return 'Video Generation';
    case 'generate_copy':
      return 'Copy Generation';
    default:
      return 'Marketing Job';
  }
}

export function marketingJobStatusLabel(status: MarketingJobStatus): string {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'generating':
      return 'Generating';
    case 'reviewing':
      return 'Reviewing';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

export function campaignAssetStatusLabel(status: CampaignAsset['status']): string {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'generating':
      return 'Generating';
    case 'ready':
      return 'Ready';
    default:
      return status;
  }
}
