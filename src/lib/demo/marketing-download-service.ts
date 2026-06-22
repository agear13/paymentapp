import type { DemoDeliverableDownloadTarget } from '@/lib/demo/demo-reports.types';
import { isDemoModeEnabled } from '@/lib/demo/demo-mode';
import {
  checkDemoDeliverableExists,
  downloadDemoDeliverableFile,
  getDemoDownloadAsset,
  showDemoAssetMissingToast,
  tryDownloadDemoDeliverable,
} from '@/lib/demo/demo-deliverable-download';
import { getDemoCampaignDeliverables } from '@/lib/demo/demo-reports';
import {
  isFinalDeliveryUnlocked,
  isStrategyReviewPhase,
} from '@/lib/marketing-jobs/marketing-agency-phase';
import { marketingToasts } from '@/lib/marketing-jobs/notifications';
import type { MarketingJobEngine } from '@/lib/marketing-jobs/job-engine';
import type { MarketingWorkspaceState } from '@/lib/marketing-jobs/types';

export type MarketingDeliverableTarget = DemoDeliverableDownloadTarget;

function resolveDeliverables(state: MarketingWorkspaceState) {
  return getDemoCampaignDeliverables({
    campaignId: state.campaignContext.campaign.id,
    companyName: state.campaignContext.company.name,
    campaignTitle: state.campaignContext.campaign.title,
  });
}

/** Demo workflow gate — prevents wrong deliverables at wrong stages. */
export function canDownloadMarketingDeliverable(
  target: MarketingDeliverableTarget,
  state: MarketingWorkspaceState
): boolean {
  if (!isDemoModeEnabled()) return true;
  if (target === 'strategy') return isStrategyReviewPhase(state);
  return isFinalDeliveryUnlocked(state);
}

export function marketingDeliverableBlockedMessage(target: MarketingDeliverableTarget): string {
  if (target === 'strategy') {
    return 'The Campaign Strategy Report is available after the AI Strategy Team completes planning.';
  }
  return 'Final deliverables unlock after creative production, asset import, and Marketing Operations complete.';
}

export async function executeMarketingDeliverableDownload(
  target: MarketingDeliverableTarget,
  input: { engine: MarketingJobEngine; state: MarketingWorkspaceState }
): Promise<'ok' | 'missing' | 'failed' | 'legacy' | 'blocked'> {
  if (isDemoModeEnabled() && !canDownloadMarketingDeliverable(target, input.state)) {
    marketingToasts.error(marketingDeliverableBlockedMessage(target));
    return 'blocked';
  }

  if (isDemoModeEnabled()) {
    const deliverables = resolveDeliverables(input.state);
    return tryDownloadDemoDeliverable(deliverables, target);
  }

  switch (target) {
    case 'client':
      input.engine.downloadClientReport();
      break;
    case 'aiTeam':
      input.engine.downloadAiTeamReport();
      break;
    case 'package':
      input.engine.downloadCampaignPackage();
      break;
    case 'strategy':
      input.engine.downloadCampaignStrategyReport();
      break;
    default:
      break;
  }

  return 'legacy';
}

export async function validateMarketingDeliverableExists(
  target: MarketingDeliverableTarget,
  state: MarketingWorkspaceState
): Promise<boolean> {
  if (!isDemoModeEnabled()) return true;
  return checkDemoDeliverableExists(resolveDeliverables(state), target);
}

export async function downloadMarketingDeliverableAfterPrep(
  target: MarketingDeliverableTarget,
  state: MarketingWorkspaceState
): Promise<'ok' | 'failed'> {
  if (!isDemoModeEnabled()) return 'failed';
  return downloadDemoDeliverableFile(resolveDeliverables(state), target);
}

export function getMarketingDeliverablePathHint(
  target: MarketingDeliverableTarget,
  state: MarketingWorkspaceState
): string {
  return getDemoDownloadAsset(resolveDeliverables(state), target).publicPathHint;
}

export function notifyMarketingDeliverableMissing(
  target: MarketingDeliverableTarget,
  state: MarketingWorkspaceState
): void {
  showDemoAssetMissingToast(target, getMarketingDeliverablePathHint(target, state));
}
