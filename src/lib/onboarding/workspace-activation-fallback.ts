import type { WorkspaceActivationSnapshot } from '@/lib/onboarding/workspace-activation-types';
import type { NextRecommendedAction } from '@/lib/onboarding/next-recommended-action';
import { deriveWorkspaceActivationFromOperations } from '@/lib/operations/orchestration/activation-bridge';
import type { WorkspaceActivationInput } from '@/lib/onboarding/workspace-activation-state';
import { deriveNextRecommendedAction } from '@/lib/onboarding/next-recommended-action';

export const ACTIVATION_FALLBACK_CHECKLIST = [
  { id: 'workspace' as const, label: 'Workspace created', complete: true },
  { id: 'project' as const, label: 'First project created', complete: true },
  { id: 'participants' as const, label: 'Participants added', complete: false },
  { id: 'compensation' as const, label: 'Participant compensation configured', complete: false },
  { id: 'provider' as const, label: 'Payment provider connected', complete: false },
  { id: 'revenue' as const, label: 'Revenue collection ready', complete: false },
  { id: 'obligations' as const, label: 'Obligations tracked', complete: false },
  { id: 'release' as const, label: 'First payout release completed', complete: false },
];

export function createFallbackActivation(
  partial?: Partial<WorkspaceActivationSnapshot>
): WorkspaceActivationSnapshot {
  const base = deriveWorkspaceActivationFromOperations({
    hasOrganization: true,
    onboardingCompleted: false,
    projectCreated: true,
    participantCount: 1,
    participantsConfigured: false,
    participantsConfiguredCount: 0,
    obligationCount: 0,
    paymentLinkCount: 0,
    collectionPreferenceDecideLater: true,
    defaultCurrency: null,
    stripeConfigured: false,
    wiseConfigured: false,
    hederaConfigured: false,
    releaseEligibleCount: 0,
    releaseBatchCount: 0,
    primaryProjectId: null,
  });
  return {
    ...base,
    phaseLabel: 'Workspace setup in progress',
    onboardingProgressPercent: Math.min(base.onboardingProgressPercent, 75),
    needsGuidance: true,
    degraded: true,
    ...partial,
  };
}

export function createFallbackNextAction(
  primaryProjectId?: string | null
): NextRecommendedAction {
  const href = primaryProjectId
    ? `/dashboard/projects/${encodeURIComponent(primaryProjectId)}/participants`
    : '/dashboard/projects';
  return {
    id: 'compensation-fallback',
    title: 'Configure participant earnings',
    description:
      'Define how each participant gets paid before tracking obligations and settlement readiness.',
    href,
    ctaLabel: 'Configure earnings',
    blockers: ['Compensation structure missing'],
  };
}

export function needsActivationGuidance(activation: WorkspaceActivationSnapshot): boolean {
  if (activation.degraded) return true;
  if (activation.needsGuidance) return true;
  const incomplete = activation.checklist.some((c) => !c.complete);
  if (incomplete) return true;
  if (activation.activationBlockers.length > 0) return true;
  if (activation.participantCount > 0 && !activation.participantsConfigured) return true;
  return false;
}

export function safeDeriveActivationResponse(input: WorkspaceActivationInput): {
  activation: WorkspaceActivationSnapshot;
  nextAction: NextRecommendedAction;
} {
  try {
    const activation = deriveWorkspaceActivationFromOperations(input);
    const enriched: WorkspaceActivationSnapshot = {
      ...activation,
      needsGuidance: needsActivationGuidance({
        ...activation,
        needsGuidance: false,
        degraded: false,
      }),
      degraded: false,
    };
    return {
      activation: enriched,
      nextAction: deriveNextRecommendedAction(enriched),
    };
  } catch {
    const activation = createFallbackActivation({
      primaryProjectId: input.primaryProjectId,
      providerConnected: input.stripeConfigured || input.wiseConfigured || input.hederaConfigured,
      participantCount: input.participantCount,
    });
    return {
      activation,
      nextAction: createFallbackNextAction(input.primaryProjectId),
    };
  }
}
