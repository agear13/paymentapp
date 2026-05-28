'use client';

import * as React from 'react';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import {
  buildCanonicalStateFromSnapshot,
  workspaceContextFromCanonicalState,
  activationFromCanonicalState,
  guidanceFromCanonicalState,
  obligationsFromCanonicalState,
  attributionScopeFromCanonicalState,
} from '@/lib/operations/reducer/adapters/legacy-selectors';
import { deriveOperationalKPIs } from '@/lib/operations/reducer/derive-operational-kpis';
import { deriveCanonicalOperationalBlockers } from '@/lib/operations/reducer/derive-canonical-operational-blockers';
import type { CanonicalOperationalState } from '@/lib/operations/reducer/types';
import {
  useOperationalGuidance,
  type OperationalGuidanceOptions,
} from '@/hooks/use-operational-guidance';
import type { WorkspaceActivationInput } from '@/lib/onboarding/workspace-activation-state';

export type CanonicalOperationalStateOptions = OperationalGuidanceOptions & {
  /** When false, returns null canonical state until graph converges. */
  requireConvergence?: boolean;
};

/**
 * Single root hook for operational truth — collects events, replays reducer,
 * and exposes canonical selectors for all payout surfaces.
 */
export function useCanonicalOperationalState(options?: CanonicalOperationalStateOptions) {
  const guidance = useOperationalGuidance(options);
  const requireConvergence = options?.requireConvergence ?? false;

  const canonicalState = React.useMemo((): CanonicalOperationalState | null => {
    const graph = guidance.graph as OperationalCoordinationSnapshot;
    if (!graph?.participants?.length) return null;
    if (requireConvergence && !guidance.graphSnapshotConverged) return null;

    const activationInput: WorkspaceActivationInput = {
      hasOrganization: guidance.activation?.workspaceCreated ?? false,
      onboardingCompleted: guidance.activation?.onboardingCompleted ?? false,
      projectCreated: guidance.activation?.projectCreated ?? false,
      participantCount: guidance.activation?.participantCount ?? 0,
      participantsConfigured: guidance.activation?.participantsConfigured ?? false,
      participantsConfiguredCount: guidance.activation?.participantsConfiguredCount ?? 0,
      obligationCount: guidance.activation?.obligationCount ?? 0,
      paymentLinkCount: 0,
      collectionPreferenceDecideLater: !(guidance.activation?.revenueConfigured ?? false),
      defaultCurrency: guidance.activation?.defaultCurrency ?? 'USD',
      stripeConfigured: guidance.activation?.providerConnected ?? false,
      wiseConfigured: false,
      hederaConfigured: false,
      releaseEligibleCount: guidance.activation?.releaseEligibleCount ?? 0,
      releaseBatchCount: guidance.activation?.firstReleaseCompleted ? 1 : 0,
      primaryProjectId: guidance.activation?.primaryProjectId ?? null,
    };

    return buildCanonicalStateFromSnapshot(graph, {
      activation: activationInput,
      auditTimeline: guidance.auditTimeline,
      graphReady: guidance.graphSnapshotConverged,
      graphSnapshotConverged: guidance.graphSnapshotConverged,
    });
  }, [
    guidance.graph,
    guidance.activation,
    guidance.auditTimeline,
    guidance.graphSnapshotConverged,
    requireConvergence,
  ]);

  const workspace = React.useMemo(() => {
    if (!canonicalState || !guidance.activation) return guidance.workspaceContext;
    return workspaceContextFromCanonicalState(canonicalState, {
      hasOrganization: guidance.activation.workspaceCreated,
      onboardingCompleted: guidance.activation.onboardingCompleted,
      projectCreated: guidance.activation.projectCreated,
      participantCount: guidance.activation.participantCount,
      participantsConfigured: guidance.activation.participantsConfigured,
      participantsConfiguredCount: guidance.activation.participantsConfiguredCount,
      obligationCount: guidance.activation.obligationCount,
      paymentLinkCount: 0,
      collectionPreferenceDecideLater: !guidance.activation.revenueConfigured,
      defaultCurrency: guidance.activation.defaultCurrency,
      stripeConfigured: guidance.activation.providerConnected,
      wiseConfigured: false,
      hederaConfigured: false,
      releaseEligibleCount: guidance.activation.releaseEligibleCount,
      releaseBatchCount: guidance.activation.firstReleaseCompleted ? 1 : 0,
      primaryProjectId: guidance.activation.primaryProjectId ?? null,
    });
  }, [canonicalState, guidance.activation, guidance.workspaceContext]);

  const kpis = React.useMemo(
    () => (canonicalState ? deriveOperationalKPIs(canonicalState) : null),
    [canonicalState]
  );

  const blockers = React.useMemo(
    () => (canonicalState ? deriveCanonicalOperationalBlockers(canonicalState) : []),
    [canonicalState]
  );

  const activation = React.useMemo(() => {
    if (!canonicalState || !guidance.activation) return guidance.activation;
    return activationFromCanonicalState(canonicalState, {
      hasOrganization: guidance.activation.workspaceCreated,
      onboardingCompleted: guidance.activation.onboardingCompleted,
      projectCreated: guidance.activation.projectCreated,
      participantCount: guidance.activation.participantCount,
      participantsConfigured: guidance.activation.participantsConfigured,
      participantsConfiguredCount: guidance.activation.participantsConfiguredCount,
      obligationCount: guidance.activation.obligationCount,
      paymentLinkCount: 0,
      collectionPreferenceDecideLater: !guidance.activation.revenueConfigured,
      defaultCurrency: guidance.activation.defaultCurrency,
      stripeConfigured: guidance.activation.providerConnected,
      wiseConfigured: false,
      hederaConfigured: false,
      releaseEligibleCount: guidance.activation.releaseEligibleCount,
      releaseBatchCount: guidance.activation.firstReleaseCompleted ? 1 : 0,
      primaryProjectId: guidance.activation.primaryProjectId ?? null,
    });
  }, [canonicalState, guidance.activation]);

  const canonicalGuidance = React.useMemo(
    () => (canonicalState ? guidanceFromCanonicalState(canonicalState) : null),
    [canonicalState]
  );

  return {
    ...guidance,
    canonicalState,
    workspaceContext: workspace,
    activation,
    kpis,
    blockers,
    obligations: canonicalState ? obligationsFromCanonicalState(canonicalState) : [],
    releasePhase: canonicalState?.release.phase ?? 'INITIALIZING',
    timeline: canonicalState?.timeline ?? guidance.guidance.timeline,
    releaseBlockers: canonicalGuidance?.releaseBlockers ?? guidance.guidance.releaseBlockers,
    releaseConfidence:
      canonicalGuidance?.releaseConfidence ?? guidance.guidance.releaseConfidence,
    attributionScope: (participantId: string) =>
      canonicalState
        ? attributionScopeFromCanonicalState(canonicalState, participantId)
        : null,
    participantReadiness: (participantId: string) =>
      canonicalState?.participants.find((p) => p.participantId === participantId)?.payoutReadiness ??
      null,
    replayFingerprint: canonicalState?.replayFingerprint ?? null,
  };
}
