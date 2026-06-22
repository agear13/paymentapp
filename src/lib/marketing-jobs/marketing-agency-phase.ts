/**
 * Derives the agency workflow phase from workspace state.
 * Drives progressive UI unlocks for the investor demo narrative.
 */
import { isCreativeAssetsReady } from '@/lib/marketing-jobs/campaign-lifecycle';
import { selectVisualGenerationJob } from '@/lib/marketing-jobs/job-engine';
import { isVisualJobInFlight, isVisualJobReadyForDispatch } from '@/lib/marketing-jobs/simulation';
import type { MarketingWorkspaceState } from '@/lib/marketing-jobs/types';

export type MarketingAgencyPhase =
  | 'intake'
  | 'strategy_running'
  | 'strategy_review'
  | 'creative_running'
  | 'assets_ready'
  | 'operations'
  | 'delivery';

const OPERATIONS_PHASES = new Set([
  'ready_for_publishing',
  'publishing_approved',
  'scheduled',
  'awaiting_results',
  'performance_review',
  'operations_complete',
]);

export function resolveMarketingAgencyPhase(state: MarketingWorkspaceState): MarketingAgencyPhase {
  const visualJob = selectVisualGenerationJob(state.jobs);

  if (!visualJob) return 'intake';

  if (isVisualJobInFlight(visualJob)) return 'strategy_running';

  if (
    isVisualJobReadyForDispatch(visualJob) &&
    (state.packageApproval.status === 'none' || state.packageApproval.status === 'pending')
  ) {
    return 'strategy_review';
  }

  if (state.creativeDispatch.creativeProductionStatus === 'complete') {
    if (state.campaignLifecycle.phase === 'operations_complete') return 'delivery';
    if (isCreativeAssetsReady(state) && OPERATIONS_PHASES.has(state.campaignLifecycle.phase)) {
      return state.campaignLifecycle.phase === 'ready_for_publishing' ? 'operations' : 'delivery';
    }
    if (isCreativeAssetsReady(state)) return 'assets_ready';
    return 'assets_ready';
  }

  if (state.packageApproval.status === 'approved' || state.creativeDispatch.status === 'dispatched') {
    return 'creative_running';
  }

  return 'strategy_running';
}

export function isStrategyReviewPhase(state: MarketingWorkspaceState): boolean {
  return resolveMarketingAgencyPhase(state) === 'strategy_review';
}

export function isFinalDeliveryUnlocked(state: MarketingWorkspaceState): boolean {
  if (state.creativeDispatch.creativeProductionStatus !== 'complete') return false;
  if (!isCreativeAssetsReady(state)) return false;
  return state.campaignLifecycle.phase === 'operations_complete';
}

export function isCreativePhaseVisible(state: MarketingWorkspaceState): boolean {
  const phase = resolveMarketingAgencyPhase(state);
  return ['creative_running', 'assets_ready', 'operations', 'delivery'].includes(phase);
}

export function isOperationsSectionVisible(state: MarketingWorkspaceState): boolean {
  const phase = resolveMarketingAgencyPhase(state);
  return ['assets_ready', 'operations', 'delivery'].includes(phase);
}

export const MARKETING_AGENCY_PHASE_LABELS: Record<MarketingAgencyPhase, string> = {
  intake: 'Phase 1 — Strategy',
  strategy_running: 'Phase 1 — Strategy in progress',
  strategy_review: 'Phase 1 — Strategy ready for approval',
  creative_running: 'Phase 2 — Creative production',
  assets_ready: 'Phase 2 — Creative assets ready',
  operations: 'Phase 2 — Marketing operations',
  delivery: 'Campaign delivered',
};
