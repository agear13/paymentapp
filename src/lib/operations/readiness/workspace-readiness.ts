import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type { OperationalCompleteness } from '@/lib/operations/types/operational-completeness';
import { defaultOperationalCompleteness } from '@/lib/operations/types/operational-completeness';
import type { OperationalReadinessResult } from '@/lib/operations/types/readiness-result';
import { emptyReadiness } from '@/lib/operations/types/readiness-result';
import type { WorkspaceState } from '@/lib/operations/states/workspace-state';
import { WORKSPACE_STATE_LABELS } from '@/lib/operations/states/workspace-state';
import { projectParticipantsPath } from '@/lib/projects/project-routes';

export type WorkspaceOperationalHealth = OperationalReadinessResult & {
  state: WorkspaceState;
  completeness: OperationalCompleteness;
  phaseLabel: string;
};

export function deriveWorkspaceState(ctx: WorkspaceOperationalContext): WorkspaceState {
  if (!ctx.hasOrganization) return 'DRAFT';
  if (!ctx.onboardingCompleted) return 'CONFIGURING';
  const provider =
    ctx.stripeConfigured || ctx.wiseConfigured || ctx.hederaConfigured;
  const participantsConfigured =
    ctx.participantCount > 0 &&
    ctx.participantsConfiguredCount >= ctx.participantCount;
  if (ctx.releaseBatchCount > 0 && ctx.obligationCount > 0) return 'ACTIVE';
  if (ctx.releaseEligibleCount > 0) return 'READY_FOR_SETTLEMENT';
  if (ctx.obligationCount > 0 && participantsConfigured) return 'COORDINATING';
  if (provider && ctx.participantCount > 0 && !participantsConfigured) return 'DEGRADED';
  if (provider) return 'COLLECTING';
  if (ctx.projectCount > 0 || ctx.participantCount > 0) return 'CONFIGURING';
  return 'DRAFT';
}

export function deriveWorkspaceOperationalHealth(
  ctx: WorkspaceOperationalContext
): WorkspaceOperationalHealth {
  try {
    const state = deriveWorkspaceState(ctx);
    const provider =
      ctx.stripeConfigured || ctx.wiseConfigured || ctx.hederaConfigured;
    const revenueConfigured =
      provider ||
      ctx.paymentLinkCount > 0 ||
      !ctx.collectionPreferenceDecideLater;
    const participantsConfigured =
      ctx.participantCount > 0 &&
      ctx.participantsConfiguredCount >= ctx.participantCount;

    const completeness: OperationalCompleteness = {
      ...defaultOperationalCompleteness(),
      setupComplete: ctx.hasOrganization && ctx.onboardingCompleted,
      fundingReady: revenueConfigured,
      payoutReady: participantsConfigured,
      releaseReady: ctx.releaseEligibleCount > 0,
      settlementReady: ctx.releaseBatchCount > 0,
    };

    const blockers: string[] = [];
    const missing: string[] = [];
    const warnings: string[] = [];

    if (!ctx.hasOrganization) missing.push('Workspace created');
    if (ctx.projectCount === 0) missing.push('First project created');
    if (ctx.participantCount === 0) missing.push('Participants added');
    if (ctx.participantCount > 0 && !participantsConfigured) {
      blockers.push('Configure how each participant earns before tracking obligations');
      missing.push('Participant compensation configured');
    }
    if (!provider && participantsConfigured) {
      blockers.push('Connect a payment provider to collect revenue');
      missing.push('Payment provider connected');
    }
    if (!revenueConfigured) missing.push('Revenue collection ready');
    if (ctx.obligationCount === 0) missing.push('Obligations tracked');

    if (ctx.collectionPreferenceDecideLater && !revenueConfigured) {
      warnings.push('Collection method not chosen yet');
    }
    if (!ctx.defaultCurrency?.trim()) warnings.push('Default currency not configured');

    completeness.blockers = blockers;
    completeness.missingRequirements = missing;
    completeness.warnings = warnings;

    const checklistTotal = 8;
    let done = 0;
    if (ctx.hasOrganization) done++;
    if (ctx.projectCount > 0) done++;
    if (ctx.participantCount > 0) done++;
    if (participantsConfigured) done++;
    if (provider) done++;
    if (revenueConfigured) done++;
    if (ctx.obligationCount > 0) done++;
    if (ctx.releaseBatchCount > 0) done++;

    const readinessScore = Math.round((done / checklistTotal) * 100);
    const needsGuidance =
      !ctx.onboardingCompleted || missing.length > 0 || blockers.length > 0;

    const actions = [];
    if (ctx.participantCount > 0 && !participantsConfigured && ctx.primaryProjectId) {
      actions.push({
        id: 'compensation',
        title: 'Configure participant earnings',
        description:
          'Define how each participant gets paid before tracking obligations.',
        href: projectParticipantsPath(ctx.primaryProjectId),
        ctaLabel: 'Configure earnings',
        priority: 1,
      });
    } else if (!provider) {
      actions.push({
        id: 'provider',
        title: 'Connect your first payment provider',
        description: 'Connect Stripe or another provider to collect revenue.',
        href: '/dashboard/settings/merchant?onboarding=continue#provider-setup',
        ctaLabel: 'Connect provider',
        priority: 2,
      });
    }

    return {
      state,
      completeness,
      phaseLabel: WORKSPACE_STATE_LABELS[state],
      readinessScore,
      readinessLevel:
        state === 'DEGRADED'
          ? 'degraded'
          : readinessScore >= 100
            ? 'ready'
            : blockers.length
              ? 'partial'
              : 'none',
      blockers,
      warnings,
      missingRequirements: missing,
      nextRecommendedActions: actions,
      needsGuidance,
    };
  } catch {
    return {
      ...emptyReadiness({ readinessLevel: 'degraded', needsGuidance: true }),
      state: 'DEGRADED',
      completeness: defaultOperationalCompleteness(),
      phaseLabel: WORKSPACE_STATE_LABELS.DEGRADED,
    };
  }
}
