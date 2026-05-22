'use client';

import * as React from 'react';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  buildOperationalGuidance,
  type ExplainReadinessInput,
  type OperationalGuidanceBundle,
} from '@/lib/operations/explainability';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import { defaultWorkspaceContext } from '@/lib/operations/types/operational-context';
import { useWorkspaceActivation } from '@/hooks/use-workspace-activation';
import { createFallbackActivation } from '@/lib/onboarding/workspace-activation-fallback';

export type OperationalGuidanceOptions = {
  enabled?: boolean;
  scope?: 'workspace' | 'project';
  scopeTitle?: string;
  project?: RecentDeal | null;
  participants?: DemoParticipant[];
  treasury?: ProjectTreasurySummary | null;
  previousProjectState?: string | null;
};

function activationToWorkspaceContext(
  activation: ReturnType<typeof createFallbackActivation>
): WorkspaceOperationalContext {
  const provider = activation.providerConnected;
  return {
    hasOrganization: activation.workspaceCreated,
    onboardingCompleted: activation.onboardingCompleted,
    defaultCurrency: activation.defaultCurrency,
    stripeConfigured: provider,
    wiseConfigured: false,
    hederaConfigured: false,
    projectCount: activation.projectCreated ? 1 : 0,
    primaryProjectId: activation.primaryProjectId,
    participantCount: activation.participantCount,
    participantsConfiguredCount: activation.participantsConfiguredCount,
    obligationCount: activation.obligationCount,
    paymentLinkCount: 0,
    collectionPreferenceDecideLater: !activation.revenueConfigured,
    releaseEligibleCount: activation.releaseEligibleCount,
    releaseBatchCount: activation.firstReleaseCompleted ? 1 : 0,
  };
}

export function useOperationalGuidance(options?: OperationalGuidanceOptions) {
  const { activation, nextAction, loading, degraded, refresh } = useWorkspaceActivation({
    enabled: options?.enabled !== false,
  });

  const guidance = React.useMemo((): OperationalGuidanceBundle => {
    const act = activation ?? createFallbackActivation();
    const workspace = activationToWorkspaceContext(act);
    const input: ExplainReadinessInput = {
      workspace,
      scope: options?.scope ?? (options?.project ? 'project' : 'workspace'),
      scopeTitle: options?.scopeTitle ?? act.phaseLabel,
      project: options?.project,
      participants: options?.participants,
      treasury: options?.treasury,
      previousProjectState: options?.previousProjectState,
    };
    return buildOperationalGuidance(input);
  }, [
    activation,
    options?.scope,
    options?.scopeTitle,
    options?.project,
    options?.participants,
    options?.treasury,
    options?.previousProjectState,
  ]);

  const primaryAction = guidance.actions[0] ?? null;
  const nextRecommended =
    nextAction ??
    (primaryAction
      ? {
          id: primaryAction.id,
          title: primaryAction.action,
          description: primaryAction.reason,
          href: primaryAction.destination,
          ctaLabel: primaryAction.ctaLabel ?? 'Continue',
          blockers: guidance.explanation.blockers,
        }
      : null);

  return {
    guidance,
    activation,
    nextAction: nextRecommended,
    loading,
    degraded: degraded || guidance.degraded,
    refresh,
    workspaceContext: activation
      ? activationToWorkspaceContext(activation)
      : defaultWorkspaceContext(),
  };
}
