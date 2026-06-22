import {
  checkStaticAssetExists,
  downloadStaticAsset,
} from '@/lib/demo/demo-download';
import type {
  DemoCampaignDeliverables,
  DemoDeliverableDownloadTarget,
  DemoReportDefinition,
  DemoCampaignPackageDefinition,
} from '@/lib/demo/demo-reports.types';
import type { ResolvedDemoCampaignDeliverables } from '@/lib/demo/demo-reports';
import { marketingToasts } from '@/lib/marketing-jobs/notifications';

export type DemoDownloadAsset = {
  file: string;
  downloadName: string;
  publicPathHint: string;
};

export function getDemoDownloadAsset(
  deliverables: DemoCampaignDeliverables | ResolvedDemoCampaignDeliverables,
  target: DemoDeliverableDownloadTarget
): DemoDownloadAsset {
  if (target === 'strategy') {
    const report: DemoReportDefinition = deliverables.reports.strategy;
    return {
      file: report.file,
      downloadName: report.downloadName,
      publicPathHint: report.publicPathHint,
    };
  }

  if (target === 'client') {
    const report: DemoReportDefinition = deliverables.reports.client;
    return {
      file: report.file,
      downloadName: report.downloadName,
      publicPathHint: report.publicPathHint,
    };
  }

  if (target === 'aiTeam') {
    const report: DemoReportDefinition = deliverables.reports.aiTeam;
    return {
      file: report.file,
      downloadName: report.downloadName,
      publicPathHint: report.publicPathHint,
    };
  }

  const campaignPackage: DemoCampaignPackageDefinition = deliverables.campaignPackage;
  return {
    file: campaignPackage.file,
    downloadName: campaignPackage.downloadName,
    publicPathHint: campaignPackage.publicPathHint,
  };
}

export function showDemoAssetMissingToast(
  target: DemoDeliverableDownloadTarget,
  publicPathHint: string
): void {
  if (target === 'client') {
    marketingToasts.demoClientReportMissing(publicPathHint);
    return;
  }
  if (target === 'aiTeam') {
    marketingToasts.demoAiTeamReportMissing(publicPathHint);
    return;
  }
  if (target === 'strategy') {
    marketingToasts.demoStrategyReportMissing(publicPathHint);
    return;
  }
  marketingToasts.demoCampaignPackageMissing(publicPathHint);
}

export function showDemoDownloadSuccessToast(target: DemoDeliverableDownloadTarget): void {
  if (target === 'strategy') {
    marketingToasts.strategyReportDownloaded();
    return;
  }
  if (target === 'client') {
    marketingToasts.clientReportDownloaded();
    return;
  }
  if (target === 'aiTeam') {
    marketingToasts.aiTeamReportDownloaded();
    return;
  }
  marketingToasts.campaignPackageDownloaded();
}

export async function checkDemoDeliverableExists(
  deliverables: DemoCampaignDeliverables | ResolvedDemoCampaignDeliverables,
  target: DemoDeliverableDownloadTarget
): Promise<boolean> {
  const asset = getDemoDownloadAsset(deliverables, target);
  return checkStaticAssetExists(asset.file);
}

/**
 * Validates, downloads, and toasts — used when preparation animation is not shown (engine path).
 */
export async function tryDownloadDemoDeliverable(
  deliverables: DemoCampaignDeliverables | ResolvedDemoCampaignDeliverables,
  target: DemoDeliverableDownloadTarget
): Promise<'ok' | 'missing' | 'failed'> {
  const asset = getDemoDownloadAsset(deliverables, target);
  const exists = await checkStaticAssetExists(asset.file);
  if (!exists) {
    showDemoAssetMissingToast(target, asset.publicPathHint);
    return 'missing';
  }

  try {
    await downloadStaticAsset(asset.file, asset.downloadName);
    showDemoDownloadSuccessToast(target);
    return 'ok';
  } catch {
    marketingToasts.error('Download failed. Please try again.');
    return 'failed';
  }
}

/**
 * Downloads after UI preparation — assumes existence was already validated.
 */
export async function downloadDemoDeliverableFile(
  deliverables: DemoCampaignDeliverables | ResolvedDemoCampaignDeliverables,
  target: DemoDeliverableDownloadTarget
): Promise<'ok' | 'failed'> {
  const asset = getDemoDownloadAsset(deliverables, target);

  try {
    await downloadStaticAsset(asset.file, asset.downloadName);
    showDemoDownloadSuccessToast(target);
    return 'ok';
  } catch {
    marketingToasts.error('Download failed. Please try again.');
    return 'failed';
  }
}
