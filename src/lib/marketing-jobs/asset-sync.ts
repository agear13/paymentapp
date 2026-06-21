import type { CampaignAsset, MarketingJob } from '@/lib/marketing-jobs/types';

export function syncAssetsWithVisualJob(assets: CampaignAsset[], job: MarketingJob): CampaignAsset[] {
  if (job.jobType !== 'generate_visuals') return assets;

  return assets.map((asset) => {
    if (asset.jobId && asset.jobId !== job.id) return asset;
    if (asset.status === 'ready') return asset;

    switch (job.status) {
      case 'queued':
        return { ...asset, status: 'queued', jobId: job.id };
      case 'generating':
      case 'reviewing':
        return { ...asset, status: 'generating', jobId: job.id };
      case 'completed':
        return asset.importedAt
          ? { ...asset, status: 'ready', jobId: job.id }
          : { ...asset, status: 'generating', jobId: job.id };
      case 'failed':
        return { ...asset, status: 'queued', jobId: job.id };
      default:
        return asset;
    }
  });
}

export function countAssetsByStatus(assets: CampaignAsset[], status: CampaignAsset['status']): number {
  return assets.filter((asset) => asset.status === status).length;
}
