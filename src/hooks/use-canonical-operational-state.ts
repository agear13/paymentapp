'use client';

import * as React from 'react';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import {
  buildPersistedCoordinationSnapshot,
  hasPersistedOperationalEntities,
} from '@/lib/operations/selectors/build-persisted-coordination-snapshot';
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
import { assertPersistedEntityDominanceInvariants } from '@/lib/operations/dev/operational-invariants';
import type { CanonicalOperationalState } from '@/lib/operations/reducer/types';
import {
  useOperationalGuidance,
  type OperationalGuidanceOptions,
} from '@/hooks/use-operational-guidance';
import type { WorkspaceActivationInput } from '@/lib/onboarding/workspace-activation-state';

export type CanonicalOperationalStateOptions = OperationalGuidanceOptions & {
  /** When false, returns null canonical state until graph converges. */
  requireConvergence?: boolean;
  /** Dev tracing label for cross-surface KPI convergence checks. */
  traceSurface?: string;
};

function resolveAuthoritativeSnapshot(
  guidanceGraph: OperationalCoordinationSnapshot,
  options?: CanonicalOperationalStateOptions
): OperationalCoordinationSnapshot | null {
  const persistedParticipants = options?.participants ?? [];
  if (hasPersistedOperationalEntities(persistedParticipants)) {
    return buildPersistedCoordinationSnapshot({
      participants: persistedParticipants,
      projectId: options?.project?.id ?? null,
      treasury: options?.treasury,
    });
  }

  if (
    (guidanceGraph?.participants?.length ?? 0) > 0 ||
    (guidanceGraph?.summary?.participantCount ?? 0) > 0
  ) {
    return guidanceGraph;
  }

  return null;
}

/**
 * Single root hook for operational truth — persisted entities are authoritative;
 * audit events are supplemental history only.
 */
export function useCanonicalOperationalState(options?: CanonicalOperationalStateOptions) {
  const guidance = useOperationalGuidance(options);
  const requireConvergence = options?.requireConvergence ?? false;

  const canonicalState = React.useMemo((): CanonicalOperationalState | null => {
    const graph = resolveAuthoritativeSnapshot(
      guidance.graph as OperationalCoordinationSnapshot,
      options
    );
    if (!graph?.participants?.length) return null;
    if (requireConvergence && !guidance.graphSnapshotConverged && !options?.participants?.length) {
      return null;
    }

    const activationInput: WorkspaceActivationInput = {
      hasOrganization: guidance.activation?.workspaceCreated ?? false,
      onboardingCompleted: guidance.activation?.onboardingCompleted ?? false,
      projectCreated: guidance.activation?.projectCreated ?? false,
      participantCount: Math.max(
        guidance.activation?.participantCount ?? 0,
        graph.summary.participantCount
      ),
      participantsConfigured: graph.summary.earningsConfiguredCount >= graph.summary.participantCount,
      participantsConfiguredCount: graph.summary.earningsConfiguredCount,
      obligationCount: Math.max(
        guidance.activation?.obligationCount ?? 0,
        graph.obligations.length
      ),
      paymentLinkCount: 0,
      collectionPreferenceDecideLater: !(guidance.activation?.revenueConfigured ?? false),
      defaultCurrency: guidance.activation?.defaultCurrency ?? 'USD',
      stripeConfigured: guidance.activation?.providerConnected ?? false,
      wiseConfigured: false,
      hederaConfigured: false,
      releaseEligibleCount: graph.summary.releaseReadyCount,
      releaseBatchCount: guidance.activation?.firstReleaseCompleted ? 1 : 0,
      primaryProjectId: guidance.activation?.primaryProjectId ?? options?.project?.id ?? null,
    };

    return buildCanonicalStateFromSnapshot(graph, {
      activation: activationInput,
      auditTimeline: guidance.auditTimeline,
      graphReady: true,
      graphSnapshotConverged: true,
      treasury: options?.treasury,
    });
  }, [
    guidance.graph,
    guidance.activation,
    guidance.auditTimeline,
    guidance.graphSnapshotConverged,
    options?.participants,
    options?.project?.id,
    options?.treasury,
    requireConvergence,
  ]);

  React.useEffect(() => {
    if (!canonicalState || process.env.NODE_ENV !== 'development') return;
    const rowsConfigured = (options?.participants ?? []).filter(
      (p) => p.compensationProfile?.configured === true || p.approvalStatus === 'Approved'
    ).length;
    assertPersistedEntityDominanceInvariants({
      persistedCompensationRowCount: rowsConfigured,
      earningsConfiguredCount: canonicalState.kpis.earningsConfiguredCount,
      persistedApprovedCount: (options?.participants ?? []).filter(
        (p) => p.approvalStatus === 'Approved'
      ).length,
      approvedAgreementCount: canonicalState.kpis.approvedAgreementCount,
      fundingReconciled: options?.treasury?.hasFundingSources ?? canonicalState.funding.reconciled,
      fundingConnectedInState: canonicalState.funding.allocated,
      obligationCount: canonicalState.kpis.obligationCount,
      obligationsTableSuppressed: false,
      payoutConfirmationCount: (options?.participants ?? []).filter(
        (p) => p.payoutVerificationConfirmed === true
      ).length,
      payoutReadyCount: canonicalState.kpis.payoutReadyCount,
    });
  }, [canonicalState, options?.participants, options?.treasury]);

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
