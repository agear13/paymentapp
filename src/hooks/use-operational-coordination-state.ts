'use client';

import * as React from 'react';
import type { OperationalCapabilities } from '@/lib/operations/capabilities/derive-operational-capabilities';
import { CONSERVATIVE_RELEASE_CAPABILITIES } from '@/lib/operations/capabilities/derive-release-interaction-state';
import {
  deriveOperationalReadinessState,
  deriveSettlementInitializationState,
  deriveOperationalOnboardingProgress,
} from '@/lib/operations/coordination';
import {
  logCoordinationTruth,
  registerCrossSurfaceOperationalKpis,
} from '@/lib/operations/dev/coordination-truth-trace';
import { traceOperationalRender } from '@/lib/operations/dev/operational-render-trace';
import { logEarningsSelectorAudit } from '@/lib/operations/dev/earnings-selector-audit';
import {
  useCanonicalOperationalState,
  type CanonicalOperationalStateOptions,
} from '@/hooks/use-canonical-operational-state';
import {
  requiresLocalOperationalInstance,
  useOperationalCoordinationContext,
} from '@/contexts/operational-coordination-context';

export type OperationalCoordinationStateOptions = CanonicalOperationalStateOptions & {
  releaseCapabilities?: OperationalCapabilities;
};

function overlayReleaseCapabilities(
  shared: ReturnType<typeof useOperationalCoordinationStateCore>,
  releaseCapabilities: OperationalCapabilities
) {
  const readiness = deriveOperationalReadinessState({
    operationalOnboarding: shared.operationalOnboarding,
    operationalInitialization: shared.operationalInitialization,
    graphSnapshotConverged: shared.graphSnapshotConverged,
    activationLoading: shared.loading,
    operationalCapabilities: releaseCapabilities,
    workspace: shared.workspaceContext,
  });
  return {
    ...shared,
    readiness,
    releaseInteraction: readiness.releaseInteraction,
  };
}

/**
 * Unified operational coordination hook — delegates to canonical reducer state.
 */
export function useOperationalCoordinationStateCore(options?: OperationalCoordinationStateOptions) {
  const canonical = useCanonicalOperationalState(options);
  const operationalCapabilities =
    options?.releaseCapabilities ?? CONSERVATIVE_RELEASE_CAPABILITIES;

  const readiness = React.useMemo(
    () =>
      deriveOperationalReadinessState({
        operationalOnboarding: canonical.operationalOnboarding,
        operationalInitialization: canonical.operationalInitialization,
        graphSnapshotConverged: canonical.graphSnapshotConverged,
        activationLoading: canonical.loading,
        operationalCapabilities,
        workspace: canonical.workspaceContext,
      }),
    [
      canonical.operationalOnboarding,
      canonical.operationalInitialization,
      canonical.graphSnapshotConverged,
      canonical.loading,
      canonical.workspaceContext,
      operationalCapabilities,
    ]
  );

  const settlementInitialization = React.useMemo(
    () =>
      deriveSettlementInitializationState({
        activationLoading: canonical.loading,
        operationalOnboarding: canonical.operationalOnboarding,
        operationalInitialization: canonical.operationalInitialization,
        graphSnapshotConverged: canonical.graphSnapshotConverged,
        nextActions: canonical.guidance.actions,
        participantCount: canonical.kpis?.participantCount ?? canonical.activation?.participantCount,
        earningsConfiguredCount:
          canonical.kpis?.earningsConfiguredCount ??
          canonical.activation?.participantsConfiguredCount,
        obligationCount:
          canonical.kpis?.obligationCount ?? canonical.activation?.obligationCount,
      }),
    [
      canonical.loading,
      canonical.operationalOnboarding,
      canonical.operationalInitialization,
      canonical.graphSnapshotConverged,
      canonical.guidance.actions,
      canonical.kpis,
      canonical.activation,
    ]
  );

  const onboardingProgress = React.useMemo(
    () =>
      deriveOperationalOnboardingProgress({
        operationalOnboarding: canonical.operationalOnboarding,
        workspace: canonical.workspaceContext,
        graphSnapshotConverged: canonical.graphSnapshotConverged,
        releaseBlockers: canonical.releaseBlockers,
        explanation: canonical.guidance.explanation,
      }),
    [
      canonical.operationalOnboarding,
      canonical.workspaceContext,
      canonical.graphSnapshotConverged,
      canonical.releaseBlockers,
      canonical.guidance.explanation,
    ]
  );

  const traceSurface = options?.traceSurface ?? 'useOperationalCoordinationState';
  const projectId =
    options?.project?.id ?? canonical.activation?.primaryProjectId ?? null;

  const coordinationMemoDeps = React.useMemo(
    () =>
      [
        canonical.graphSnapshotConverged,
        canonical.kpis?.participantCount,
        canonical.kpis?.earningsConfiguredCount,
        canonical.kpis?.payoutReadyCount,
        canonical.kpis?.obligationCount,
        canonical.degraded,
      ].join('|'),
    [
      canonical.degraded,
      canonical.graphSnapshotConverged,
      canonical.kpis,
    ]
  );

  React.useEffect(() => {
    traceOperationalRender({
      hook: 'useOperationalCoordinationState',
      phase: 'render',
      surface: traceSurface,
      projectId,
      graphSnapshotConverged: canonical.graphSnapshotConverged,
      degraded: canonical.degraded,
      participantCount: canonical.kpis?.participantCount,
      kpis: canonical.kpis,
      memoDeps: coordinationMemoDeps,
    });
  }, [
    canonical.degraded,
    canonical.graphSnapshotConverged,
    canonical.kpis,
    coordinationMemoDeps,
    projectId,
    traceSurface,
  ]);

  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const apiSummary = canonical.graph?.summary
      ? {
          participantCount: canonical.graph.summary.participantCount,
          earningsConfiguredCount: canonical.graph.summary.earningsConfiguredCount,
          payoutReadyCount: canonical.graph.summary.payoutReadyCount,
          releaseReadyCount: canonical.graph.summary.releaseReadyCount,
          obligationCount: canonical.graph.obligations?.length ?? 0,
        }
      : null;

    logCoordinationTruth({
      surface: traceSurface,
      hook: 'useOperationalCoordinationState',
      projectId,
      apiSummary,
      canonicalKpis: canonical.kpis,
      renderedKpis: canonical.kpis,
      degraded: canonical.degraded,
      graphReady: canonical.graph?.summary
        ? (canonical.graph.summary.participantCount ?? 0) > 0
        : undefined,
      graphConverged: canonical.graphSnapshotConverged,
      initializationBlocked: settlementInitialization.showInitializationShell,
    });

    if (canonical.kpis) {
      registerCrossSurfaceOperationalKpis({
        surface: traceSurface,
        projectId,
        participantCount: canonical.kpis.participantCount,
        earningsConfiguredCount: canonical.kpis.earningsConfiguredCount,
        payoutReadyCount: canonical.kpis.payoutReadyCount,
        obligationCount: canonical.kpis.obligationCount,
        releaseEligibleCount: canonical.kpis.releaseEligibleCount,
        fundingAllocated: canonical.canonicalState?.funding.allocated ?? false,
      });
    }
  }, [
    canonical.activation?.primaryProjectId,
    canonical.canonicalState?.funding.allocated,
    canonical.degraded,
    canonical.graph,
    canonical.graphSnapshotConverged,
    canonical.kpis,
    projectId,
    settlementInitialization.showInitializationShell,
    traceSurface,
  ]);

  React.useEffect(() => {
    if (!canonical.kpis || process.env.NODE_ENV !== 'development') return;
    const sample = options?.participants?.[0] ?? canonical.graph?.participants?.[0]?.participant;
    if (sample) {
      logEarningsSelectorAudit({
        surface: traceSurface,
        participant: sample,
        canonicalKpis: canonical.kpis,
      });
    }
  }, [canonical.graph?.participants, canonical.kpis, options?.participants, traceSurface]);

  React.useEffect(() => {
    if (!canonical.canonicalState || process.env.NODE_ENV !== 'development') return;
    console.groupCollapsed('[operational-sync] selector-recompute');
    console.log('at', new Date().toISOString());
    console.log('surface', traceSurface);
    console.log('projectId', projectId);
    console.log('kpis', canonical.kpis);
    console.log('replayFingerprint', canonical.replayFingerprint);
    console.groupEnd();
  }, [canonical.canonicalState, canonical.kpis, canonical.replayFingerprint, projectId, traceSurface]);

  return {
    ...canonical,
    readiness,
    settlementInitialization,
    onboardingProgress,
    releaseInteraction: readiness.releaseInteraction,
    reloadCoordinationSnapshot: canonical.reloadCoordinationSnapshot,
    refreshOperationalState: canonical.refresh,
  };
}

/** Returns shared workspace context when available; otherwise a local project-scoped instance. */
export function useOperationalCoordinationState(options?: OperationalCoordinationStateOptions) {
  const shared = useOperationalCoordinationContext();
  const needsLocal = requiresLocalOperationalInstance(options);

  const local = useOperationalCoordinationStateCore(
    needsLocal || !shared ? options : { ...options, enabled: false }
  );

  if (!needsLocal && shared) {
    return options?.releaseCapabilities
      ? overlayReleaseCapabilities(shared, options.releaseCapabilities)
      : shared;
  }
  return local;
}
