import type { OperationalAction, OperationalExplainability } from '@/lib/operations/explainability/types';
import type { OperationalReleaseBlockerDetail } from '@/lib/operations/explainability/derive-operational-release-blockers';
import { deriveNextOperationalActions } from '@/lib/operations/explainability/derive-next-operational-actions';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type { OperationalOnboardingState } from '@/lib/operations/onboarding/operational-onboarding-phases';
import { safeOperationalNavigation } from '@/lib/operations/routing/operational-route-recovery';
import {
  assertOnboardingGuidanceInvariants,
} from '@/lib/operations/dev/operational-invariants';

export type OperationalNextActionsInput = {
  explanation: OperationalExplainability;
  workspace: WorkspaceOperationalContext;
  releaseBlockers?: OperationalReleaseBlockerDetail[];
  graphReady?: boolean;
  graphSnapshotConverged?: boolean;
  operationalOnboarding?: OperationalOnboardingState | null;
};

function actionFromBlocker(
  blocker: OperationalReleaseBlockerDetail,
  index: number
): OperationalAction {
  return {
    id: blocker.id || `blocker-${index}`,
    action: blocker.remediation,
    reason: blocker.reason,
    impact: blocker.unlockCondition,
    urgency: blocker.operatorActionRequired ? 'critical' : 'high',
    destination: blocker.ctaHref,
    ctaLabel: blocker.ctaLabel,
  };
}

function postRailsProgressionActions(
  workspace: WorkspaceOperationalContext
): OperationalAction[] {
  const actions: OperationalAction[] = [];
  const projectHref = safeOperationalNavigation('configure_earnings', workspace.primaryProjectId);
  const obligationsHref = safeOperationalNavigation('review_obligations', workspace.primaryProjectId);

  if (workspace.participantCount > 0 && workspace.participantsConfiguredCount < workspace.participantCount) {
    const missing = workspace.participantCount - workspace.participantsConfiguredCount;
    actions.push({
      id: 'next-configure-earnings',
      action: `Configure earnings for ${missing} participant${missing === 1 ? '' : 's'}`,
      reason: 'Participant compensation must be saved before agreements and payout obligations converge.',
      impact: 'Unlocks agreement sharing and payout readiness tracking',
      urgency: 'critical',
      destination: projectHref,
      ctaLabel: 'Configure earnings',
    });
  }

  if (workspace.participantsConfiguredCount > 0 && workspace.obligationCount === 0) {
    actions.push({
      id: 'next-review-obligations',
      action: 'Review payout obligations',
      reason: 'Customer payments and approved agreements create payout obligations to coordinate.',
      impact: 'Enables funding and release readiness review',
      urgency: 'high',
      destination: obligationsHref,
      ctaLabel: 'Review obligations',
    });
  }

  if (workspace.releaseEligibleCount > 0) {
    actions.push({
      id: 'next-review-release',
      action: 'Review payout release readiness',
      reason: `${workspace.releaseEligibleCount} participant${workspace.releaseEligibleCount === 1 ? '' : 's'} pass release checks in the coordination graph.`,
      impact: 'Prepares payout release when infrastructure is available',
      urgency: 'medium',
      destination: '/dashboard/payouts/settlements',
      ctaLabel: 'Review releases',
    });
  }

  return actions;
}

/**
 * Canonical next-action selector — all operational guidance surfaces must consume this output.
 */
export function deriveOperationalNextActions(
  input: OperationalNextActionsInput
): OperationalAction[] {
  const graphReady = input.graphReady === true;
  const graphConverged = input.graphSnapshotConverged !== false;
  const blockers = input.releaseBlockers ?? [];
  const onboarding = input.operationalOnboarding;

  let actions: OperationalAction[];

  if (!graphReady || !graphConverged) {
    const primary = blockers[0];
    actions = [
      {
        id: 'resume-coordination',
        action: primary?.remediation ?? 'Reload coordination snapshot',
        reason:
          primary?.reason ??
          onboarding?.recoveryMessage ??
          'Settlement coordination is still converging after payment rails were connected.',
        impact:
          primary?.unlockCondition ??
          'Release actions unlock once the operational graph synchronizes.',
        urgency: 'high',
        destination: primary?.ctaHref ?? '/dashboard/payouts',
        ctaLabel: primary?.ctaLabel ?? 'Review payouts',
      },
      ...blockers.slice(1, 3).map(actionFromBlocker),
      ...postRailsProgressionActions(input.workspace),
    ];
  } else {
    actions = [
      ...postRailsProgressionActions(input.workspace),
      ...deriveNextOperationalActions(input.explanation, input.workspace),
      ...blockers.slice(0, 3).map(actionFromBlocker),
    ];
  }

  const seen = new Set<string>();
  const unique: OperationalAction[] = [];
  for (const action of actions) {
    const key = `${action.id}:${action.action}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(action);
  }

  assertOnboardingGuidanceInvariants({
    graphReady,
    graphSnapshotConverged: graphConverged,
    nextActionCount: unique.length,
    hasStripeConnected: onboarding?.stripeConnected,
    participantCount: input.workspace.participantCount,
    guidanceHeadline: input.explanation.explainability?.headline,
  });

  return unique;
}
