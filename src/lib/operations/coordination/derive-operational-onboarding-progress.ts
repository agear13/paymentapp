import type { OperationalOnboardingState } from '@/lib/operations/onboarding/operational-onboarding-phases';
import { onboardingInitializationProgress } from '@/lib/operations/onboarding/operational-onboarding-phases';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type { OperationalAction } from '@/lib/operations/explainability/types';
import { deriveOperationalNextActions } from '@/lib/operations/explainability/derive-operational-next-actions';
import type { OperationalExplainability } from '@/lib/operations/explainability/types';
import type { OperationalReleaseBlockerDetail } from '@/lib/operations/explainability/derive-operational-release-blockers';
import type {
  OperationalOnboardingProgress,
  OperationalOnboardingStage,
} from '@/lib/operations/coordination/types';
import { assertOnboardingGuidanceInvariants } from '@/lib/operations/dev/operational-invariants';
import { isGraphReadyForProjection } from '@/lib/operations/coordination/derive-operational-readiness-state';

export type OperationalOnboardingProgressInput = {
  operationalOnboarding?: OperationalOnboardingState | null;
  workspace: WorkspaceOperationalContext;
  graphSnapshotConverged?: boolean;
  releaseBlockers?: OperationalReleaseBlockerDetail[];
  explanation?: OperationalExplainability;
};

function deriveProgressStages(
  onboarding: OperationalOnboardingState | null,
  workspace: WorkspaceOperationalContext
): OperationalOnboardingStage[] {
  const infra = onboarding
    ? onboardingInitializationProgress(onboarding).steps
    : [];
  const stages: OperationalOnboardingStage[] = infra.map((s) => ({
    id: s.id,
    label: s.label,
    complete: s.complete,
    required: true,
  }));

  const participantsComplete =
    workspace.participantCount > 0 &&
    workspace.participantsConfiguredCount >= workspace.participantCount;

  stages.push({
    id: 'participant-earnings',
    label: 'Participant earnings configured',
    complete: participantsComplete,
    required: workspace.participantCount > 0,
    releaseImpact: 'Required before agreements and payout obligations converge.',
  });

  stages.push({
    id: 'provider',
    label: 'Payment provider connected',
    complete:
      workspace.stripeConfigured || workspace.wiseConfigured || workspace.hederaConfigured,
    required: true,
    releaseImpact: 'Revenue collection must be active before funding obligations.',
  });

  stages.push({
    id: 'obligations',
    label: 'Payout obligations tracked',
    complete: workspace.obligationCount > 0,
    required: false,
    releaseImpact: 'Obligations appear as customer payments and approvals converge.',
  });

  stages.push({
    id: 'release-ready',
    label: 'Release readiness achieved',
    complete: workspace.releaseEligibleCount > 0,
    required: false,
    releaseImpact: 'Enables payout release review when infrastructure permits.',
  });

  return stages;
}

function completionPercent(stages: OperationalOnboardingStage[]): number {
  if (stages.length === 0) return 0;
  const required = stages.filter((s) => s.required);
  const pool = required.length > 0 ? required : stages;
  const complete = pool.filter((s) => s.complete).length;
  return Math.round((complete / pool.length) * 100);
}

/**
 * Canonical onboarding progression — all onboarding surfaces must consume this selector.
 */
export function deriveOperationalOnboardingProgress(
  input: OperationalOnboardingProgressInput
): OperationalOnboardingProgress {
  const onboarding = input.operationalOnboarding ?? null;
  const graphReady = isGraphReadyForProjection(onboarding);
  const graphConverged = input.graphSnapshotConverged === true;

  const explanation: OperationalExplainability =
    input.explanation ?? {
      readinessLevel: graphReady && graphConverged ? 'partial' : 'blocked',
      readinessScore: 0,
      blockers: onboarding?.blockers ?? [],
      warnings: [],
      confidence: graphReady && graphConverged ? 'MEDIUM' : 'BLOCKED',
      missingRequirements: [],
      nextRecommendedActions: [],
      explainability: {
        headline: onboarding
          ? onboardingInitializationProgress(onboarding).headline
          : 'Operational setup',
        bullets: onboarding?.blockers ?? [],
      },
      trustState: 'attention',
      phaseLabel: onboarding?.phase ?? 'ONBOARDING_STARTED',
      scopeTitle: 'Workspace',
    };

  const allActions = deriveOperationalNextActions({
    explanation,
    workspace: input.workspace,
    releaseBlockers: input.releaseBlockers,
    graphReady,
    graphSnapshotConverged: graphConverged,
    operationalOnboarding: onboarding,
  });

  const requiredActions = allActions.filter((a) => a.urgency === 'critical' || a.urgency === 'high');
  const optionalActions = allActions.filter((a) => a.urgency === 'medium' || a.urgency === 'low');

  const stages = deriveProgressStages(onboarding, input.workspace);
  const percent = completionPercent(stages);

  const releaseImpact =
    input.workspace.releaseEligibleCount > 0
      ? `${input.workspace.releaseEligibleCount} participant${input.workspace.releaseEligibleCount === 1 ? '' : 's'} ready for payout release review.`
      : requiredActions[0]?.impact ?? null;

  const progress: OperationalOnboardingProgress = {
    currentStage:
      graphReady && graphConverged
        ? 'COORDINATION_ACTIVE'
        : onboarding?.phase ?? 'ONBOARDING_STARTED',
    completionPercent: percent,
    headline: explanation.explainability.headline,
    blockers: [...(onboarding?.blockers ?? []), ...explanation.blockers],
    requiredActions,
    optionalActions,
    stages,
    releaseImpact,
  };

  assertOnboardingGuidanceInvariants({
    graphReady,
    graphSnapshotConverged: graphConverged,
    nextActionCount: allActions.length,
    hasStripeConnected: onboarding?.stripeConnected,
    participantCount: input.workspace.participantCount,
    guidanceHeadline: progress.headline,
  });

  return progress;
}
