/**
 * Bridge from operations domain → legacy WorkspaceActivationSnapshot (UI compatibility).
 */

import type { WorkspaceActivationInput } from '@/lib/onboarding/workspace-activation-state';
import type {
  ActivationChecklistItem,
  WorkspaceActivationPhase,
  WorkspaceActivationSnapshot,
} from '@/lib/onboarding/workspace-activation-types';
import { orchestrateOperations } from '@/lib/operations/orchestration/operational-orchestrator';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type { NextRecommendedAction } from '@/lib/onboarding/next-recommended-action';
import { deriveNextRecommendedAction } from '@/lib/onboarding/next-recommended-action';

function inputToContext(input: WorkspaceActivationInput): WorkspaceOperationalContext {
  return {
    hasOrganization: input.hasOrganization,
    onboardingCompleted: input.onboardingCompleted,
    defaultCurrency: input.defaultCurrency,
    stripeConfigured: input.stripeConfigured,
    wiseConfigured: input.wiseConfigured,
    hederaConfigured: input.hederaConfigured,
    projectCount: input.projectCreated ? 1 : 0,
    primaryProjectId: input.primaryProjectId,
    participantCount: input.participantCount,
    participantsConfiguredCount: input.participantsConfiguredCount,
    obligationCount: input.obligationCount,
    paymentLinkCount: input.paymentLinkCount,
    collectionPreferenceDecideLater: input.collectionPreferenceDecideLater,
    releaseEligibleCount: input.releaseEligibleCount,
    releaseBatchCount: input.releaseBatchCount,
  };
}

function mapPhase(state: string): { phase: WorkspaceActivationPhase; label: string } {
  switch (state) {
    case 'COLLECTING':
      return { phase: 'ready_to_collect', label: 'Ready to collect revenue' };
    case 'COORDINATING':
    case 'READY_FOR_SETTLEMENT':
      return { phase: 'ready_to_coordinate', label: 'Ready to coordinate payouts' };
    case 'ACTIVE':
      return { phase: 'ready_for_release', label: 'Ready for payout release' };
    default:
      return { phase: 'setup_in_progress', label: 'Workspace setup in progress' };
  }
}

function buildLegacyChecklist(input: WorkspaceActivationInput): ActivationChecklistItem[] {
  const provider =
    input.stripeConfigured || input.wiseConfigured || input.hederaConfigured;
  const revenue =
    provider ||
    input.paymentLinkCount > 0 ||
    !input.collectionPreferenceDecideLater;
  return [
    { id: 'workspace', label: 'Workspace created', complete: input.hasOrganization },
    { id: 'project', label: 'First project created', complete: input.projectCreated },
    { id: 'participants', label: 'Participants added', complete: input.participantCount > 0 },
    {
      id: 'compensation',
      label: 'Commercial terms captured',
      complete: input.participantsConfigured,
    },
    { id: 'provider', label: 'Settlement infrastructure configured', complete: provider },
    { id: 'revenue', label: 'Agreement ready for settlement', complete: revenue },
    { id: 'obligations', label: 'Obligations tracked', complete: input.obligationCount > 0 },
    {
      id: 'release',
      label: 'First payout release completed',
      complete: input.releaseBatchCount > 0,
    },
  ];
}

/** Derive legacy activation snapshot via canonical operations layer. */
export function deriveWorkspaceActivationFromOperations(
  input: WorkspaceActivationInput
): WorkspaceActivationSnapshot {
  const ctx = inputToContext(input);
  const orch = orchestrateOperations({ workspace: ctx });
  const { phase, label } = mapPhase(orch.workspaceState);
  const checklist = buildLegacyChecklist(input);
  const provider =
    input.stripeConfigured || input.wiseConfigured || input.hederaConfigured;
  const revenue =
    provider ||
    input.paymentLinkCount > 0 ||
    !input.collectionPreferenceDecideLater;

  return {
    workspaceCreated: input.hasOrganization,
    projectCreated: input.projectCreated,
    participantCount: input.participantCount,
    participantsConfigured: input.participantsConfigured,
    participantsConfiguredCount: input.participantsConfiguredCount,
    obligationsCreated: input.obligationCount > 0,
    obligationCount: input.obligationCount,
    revenueConfigured: revenue,
    providerConnected: provider,
    payoutMethodConfigured: provider,
    releaseEligible: input.releaseEligibleCount > 0,
    releaseEligibleCount: input.releaseEligibleCount,
    firstReleaseCompleted: input.releaseBatchCount > 0,
    onboardingCompleted: input.onboardingCompleted,
    defaultCurrency: input.defaultCurrency,
    onboardingProgressPercent: orch.activationProgressPercent,
    phase,
    phaseLabel: orch.phaseLabel || label,
    checklist,
    activationBlockers: orch.blockers,
    setupWarnings: orch.warnings,
    primaryProjectId: input.primaryProjectId,
    needsGuidance: orch.needsGuidance,
    degraded: orch.degraded,
  };
}

export function deriveNextActionFromOperations(
  input: WorkspaceActivationInput
): NextRecommendedAction {
  const activation = deriveWorkspaceActivationFromOperations(input);
  const action = orchestrateOperations({ workspace: inputToContext(input) })
    .nextRecommendedActions[0];
  if (action) {
    return {
      id: action.id,
      title: action.title,
      description: action.description,
      href: action.href,
      ctaLabel: action.ctaLabel,
      blockers: activation.activationBlockers,
    };
  }
  return deriveNextRecommendedAction(activation);
}
