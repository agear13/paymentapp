'use client';

import * as React from 'react';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { OperationalGuidanceBundle } from '@/lib/operations/explainability';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import {
  appendOperationalAuditEntry,
  setOperationalAuditEntries,
  useOperationalAuditStore,
} from '@/hooks/use-operational-audit-store';
import {
  guidanceFromOperationalGraph,
  workspaceContextFromGraph,
} from '@/lib/operations/selectors/operational-graph-adapter';
import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import { parseCoordinationSnapshotProjection } from '@/lib/operations/selectors/operational-coordination-snapshot';
import {
  hasActiveOperationalPageLoadTrace,
  parseOperationalApiJson,
  readOperationalApiResponseDiagnostics,
} from '@/lib/operations/dev/operational-api-fetch-diagnostics';
import {
  buildPersistedCoordinationSnapshot,
  hasPersistedOperationalEntities,
  type CommercialTreasuryData,
} from '@/lib/operations/selectors/build-persisted-coordination-snapshot';
import { useWorkspaceActivation } from '@/hooks/use-workspace-activation';
import { createFallbackActivation } from '@/lib/onboarding/workspace-activation-fallback';
import { defaultWorkspaceContext } from '@/lib/operations/types/operational-context';
import type { OperationalOnboardingState } from '@/lib/operations/onboarding/operational-onboarding-phases';
import { deriveOperationalReleaseBlockers } from '@/lib/operations/explainability/derive-operational-release-blockers';
import { deriveOperationalNextActions } from '@/lib/operations/explainability/derive-operational-next-actions';
import { assertOperationalProjectionInvariants } from '@/lib/operations/dev/operational-invariants';
import { subscribeProjectOperationalEvents } from '@/lib/operations/orchestration/operational-sync-client';
import { dispatchOperationalEvent } from '@/lib/operations/orchestration/operational-event-bus';
import { isGraphReadyForProjection } from '@/lib/operations/coordination/derive-operational-readiness-state';
import {
  emptyOperationalGraphProjection,
  safeOperationalProjection,
} from '@/lib/operations/coordination/safe-operational-projection';
import { resolveOperationalWorkspaceCurrency } from '@/lib/currency/resolve-operational-workspace-currency';
import { traceOperationalRender } from '@/lib/operations/dev/operational-render-trace';
import { warnLegacyOperationalPath } from '@/lib/operations/dev/warn-legacy-operational-path';
import { logCoordinationFetch } from '@/lib/operations/dev/coordination-fetch-trace';
import { recordCoordinationSnapshotRequest } from '@/lib/operations/dev/coordination-request-count';

export type OperationalGuidanceOptions = {
  enabled?: boolean;
  scope?: 'workspace' | 'project';
  scopeTitle?: string;
  project?: RecentDeal | null;
  participants?: DemoParticipant[];
  treasury?: CommercialTreasuryData | null;
  previousProjectState?: string | null;
};

type GraphSummary = Pick<
  OperationalCoordinationSnapshot,
  'summary' | 'funding' | 'participants' | 'obligations'
>;

function emptyGraph(): GraphSummary {
  return emptyOperationalGraphProjection();
}

function degradedGuidance(
  recoveryMessage?: string | null,
  workspace = defaultWorkspaceContext(),
  operationalOnboarding?: OperationalOnboardingState | null
): OperationalGuidanceBundle {
  warnLegacyOperationalPath('degradedGuidance', recoveryMessage ?? 'initialization');
  const releaseBlockers = deriveOperationalReleaseBlockers({
    snapshot: {
      participants: [],
      obligations: [],
      summary: {
        participantCount: workspace.participantCount,
        earningsConfiguredCount: workspace.participantsConfiguredCount,
        payoutReadyCount: 0,
        releaseReadyCount: workspace.releaseEligibleCount,
        blockerCount: 1,
        allBlockers: [],
      },
      funding: { allocated: false, stage: null },
    },
    workspace,
    graphReady: false,
    initializationRecoveryMessage: recoveryMessage,
  });
  const primary = releaseBlockers[0];
  const headline = primary?.reason ?? 'Operational coordination initializing';
  const remediation =
    primary?.remediation ??
    'Your payment rails were connected successfully. Operational coordination is being prepared.';

  const explanation = {
    readinessLevel: 'blocked' as const,
    readinessScore: 0,
    blockers: [headline],
    warnings: [] as string[],
    missingRequirements: [] as string[],
    confidence: 'BLOCKED' as const,
    nextRecommendedActions: primary
      ? [
          {
            id: primary.id,
            title: primary.remediation,
            description: primary.unlockCondition,
            href: primary.ctaHref,
            ctaLabel: primary.ctaLabel,
            priority: 1,
          },
        ]
      : [],
    explainability: {
      headline: 'Settlement infrastructure initializing',
      bullets: [headline, remediation],
    },
    trustState: 'attention' as const,
    phaseLabel: 'Settlement infrastructure initializing',
    scopeTitle: 'Workspace',
  };

  const actions = deriveOperationalNextActions({
    explanation,
    workspace,
    releaseBlockers,
    graphReady: isGraphReadyForProjection(operationalOnboarding),
    graphSnapshotConverged: false,
    operationalOnboarding,
  });

  const currency = resolveOperationalWorkspaceCurrency({
    workspaceDefaultCurrency: workspace.defaultCurrency,
  });

  return {
    explanation,
    stateExplanation: null,
    actions,
    trustSignals: [],
    releaseBlockers,
    releaseConfidence: {
      level: 'BLOCKED',
      score: 0,
      currency,
      collectedRevenue: 0,
      reservedObligations: 0,
      readyToRelease: 0,
      heldBack: 0,
      heldBackReasons: [headline],
      blockedParticipantCount: 0,
      riskWarnings: [],
      releasableObligationCount: 0,
      totalObligationCount: 0,
      explainability: {
        headline: primary?.category === 'operational_graph_initializing'
          ? 'Settlement graph initialization in progress'
          : 'Initializing',
        bullets: [remediation],
      },
    },
    timeline: [],
    transition: null,
    degraded: true,
  };
}

/** Client hook — loads authoritative operational graph and derives guidance from it. */
export function useOperationalGuidance(options?: OperationalGuidanceOptions) {
  const { activation, nextAction, loading, degraded, refresh, operationalOnboarding, operationalInitialization } =
    useWorkspaceActivation({
    enabled: options?.enabled !== false,
  });
  const graphReadyForProjection = isGraphReadyForProjection(
    operationalOnboarding,
    operationalInitialization
  );
  const projectId = options?.project?.id ?? activation?.primaryProjectId ?? null;
  const [graph, setGraph] = React.useState<GraphSummary>(emptyGraph);
  const [graphSnapshotConverged, setGraphSnapshotConverged] = React.useState(false);
  const auditTimeline = useOperationalAuditStore({
    projectId: projectId ?? undefined,
  });
  const [graphLoading, setGraphLoading] = React.useState(false);

  const loadGraph = React.useCallback(async () => {
    if (options?.enabled === false) return;
    setGraphLoading(true);
    const snapshotRequestId = logCoordinationFetch('snapshot-start', {
      projectId: projectId ?? null,
    });
    recordCoordinationSnapshotRequest();
    const fetchStartedAt = performance.now();
    try {
      const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
      const route = `/api/operations/coordination-snapshot${qs}`;
      const res = await fetch(route, {
        cache: 'no-store',
        credentials: 'include',
      });
      const diagnostics = await readOperationalApiResponseDiagnostics(
        route,
        res,
        hasActiveOperationalPageLoadTrace()
          ? { pageLoadLabel: 'B-coordination-snapshot', startedAt: fetchStartedAt }
          : undefined
      );
      if (!diagnostics.shouldParseJson) {
        setGraphSnapshotConverged(false);
        logCoordinationFetch('snapshot-complete', {
          requestId: snapshotRequestId,
          projectId: projectId ?? null,
          durationMs: Math.round(performance.now() - fetchStartedAt),
          success: false,
        });
        return;
      }
      const json = parseOperationalApiJson<{
        data?: {
          graphReady?: boolean;
          summary: GraphSummary['summary'] | null;
          funding: GraphSummary['funding'] | null;
          participants: GraphSummary['participants'];
          obligationCount: number;
          auditTimeline?: OperationalAuditEntry[];
          participantDiagnostics?: unknown[];
        };
      }>(route, diagnostics.bodyText);
      if (!json.data) {
        setGraphSnapshotConverged(false);
        logCoordinationFetch('snapshot-complete', {
          requestId: snapshotRequestId,
          projectId: projectId ?? null,
          durationMs: Math.round(performance.now() - fetchStartedAt),
          success: false,
        });
        return;
      }
      const projection = parseCoordinationSnapshotProjection({
        graphReady: json.data.graphReady,
        summary: json.data.summary,
        funding: json.data.funding,
        participants: json.data.participants as GraphSummary['participants'],
      });
      if (!projection) {
        setGraph(emptyGraph());
        setGraphSnapshotConverged(false);
        logCoordinationFetch('snapshot-complete', {
          requestId: snapshotRequestId,
          projectId: projectId ?? null,
          durationMs: Math.round(performance.now() - fetchStartedAt),
          success: false,
        });
        return;
      }
      if (json.data.auditTimeline?.length) {
        setOperationalAuditEntries(json.data.auditTimeline);
      }
      setGraph(projection);
      setGraphSnapshotConverged(true);
      logCoordinationFetch('snapshot-complete', {
        requestId: snapshotRequestId,
        projectId: projectId ?? null,
        durationMs: Math.round(performance.now() - fetchStartedAt),
        success: true,
      });
      if (json.data?.participantDiagnostics?.length) {
        console.info('[operational-sync] coordination-snapshot participantDiagnostics', {
          projectId: projectId ?? null,
          summary: projection.summary,
          participantDiagnostics: json.data.participantDiagnostics,
        });
        const djAlex = (
          json.data.participantDiagnostics as Array<{
            participantId: string;
            name: string | null;
            compensationProfileFound: boolean;
            configuredAt: string | null;
            earningsStructure: unknown;
            selectorResult: { hasPersistedCompensationTerms: boolean };
          }>
        ).find((p) => p.name?.toLowerCase().includes('dj alex'));
        if (djAlex) {
          console.info('[participant-persistence-finding-client]', djAlex);
        }
      }
    } finally {
      setGraphLoading(false);
    }
  }, [options?.enabled, projectId]);

  React.useEffect(() => {
    if (options?.enabled === false) return;
    if (loading) return;
    void loadGraph();
  }, [loadGraph, loading, options?.enabled]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      void loadGraph();
    };
    window.addEventListener('operational-coordination-reload', handler);
    return () => window.removeEventListener('operational-coordination-reload', handler);
  }, [loadGraph]);

  React.useEffect(() => {
    if (!projectId) return;
    return subscribeProjectOperationalEvents(projectId, {
      invalidate: () => undefined,
      refreshSilent: async () => undefined,
      onAudit: appendOperationalAuditEntry,
    });
  }, [projectId, loadGraph, refresh]);

  const initializationRecoveryMessage =
    operationalOnboarding?.recoveryMessage ?? operationalInitialization?.onboarding.recoveryMessage;

  const persistedSnapshot = React.useMemo(() => {
    if (!hasPersistedOperationalEntities(options?.participants)) return null;
    return buildPersistedCoordinationSnapshot({
      participants: options!.participants!,
      projectId: options?.project?.id ?? null,
      treasury: options?.treasury,
    });
  }, [options?.participants, options?.project?.id, options?.treasury]);

  const effectiveGraph = React.useMemo((): GraphSummary => {
    const apiHasEntities =
      (graph.summary?.participantCount ?? 0) > 0 || (graph.participants?.length ?? 0) > 0;
    if (apiHasEntities) return graph;
    if (persistedSnapshot) return persistedSnapshot;
    return graph;
  }, [graph, persistedSnapshot]);

  const hasPersistedTruth = hasPersistedOperationalEntities(options?.participants);

  const guidance = React.useMemo((): OperationalGuidanceBundle => {
    const act = activation ?? createFallbackActivation();
    const snapshot = effectiveGraph as OperationalCoordinationSnapshot;
    const workspace = activation
      ? workspaceContextFromGraph(snapshot, {
          hasOrganization: act.workspaceCreated,
          onboardingCompleted: act.onboardingCompleted,
          projectCreated: act.projectCreated,
          participantCount: Math.max(act.participantCount, snapshot.summary?.participantCount ?? 0),
          participantsConfigured: act.participantsConfigured,
          participantsConfiguredCount: Math.max(
            act.participantsConfiguredCount,
            snapshot.summary?.earningsConfiguredCount ?? 0
          ),
          obligationCount: snapshot.obligations?.length ?? 0,
          paymentLinkCount: 0,
          collectionPreferenceDecideLater: !act.revenueConfigured,
          defaultCurrency: act.defaultCurrency,
          stripeConfigured: act.providerConnected,
          wiseConfigured: false,
          hederaConfigured: false,
          releaseEligibleCount: snapshot.summary?.releaseReadyCount ?? 0,
          releaseBatchCount: act.firstReleaseCompleted ? 1 : 0,
          primaryProjectId: act.primaryProjectId,
        })
      : defaultWorkspaceContext();

    if (hasPersistedTruth && snapshot.participants.length > 0) {
      return guidanceFromOperationalGraph({
        snapshot,
        workspace,
        scope: options?.scope ?? (options?.project ? 'project' : 'workspace'),
        scopeTitle: options?.scopeTitle ?? act.phaseLabel,
        auditTimeline,
        graphReady: true,
        graphSnapshotConverged: true,
        initializationRecoveryMessage,
        operationalOnboarding: operationalOnboarding ?? undefined,
      });
    }

    const apiHasEntities =
      (snapshot.summary?.participantCount ?? 0) > 0 ||
      (snapshot.participants?.length ?? 0) > 0;

    if (
      !hasPersistedTruth &&
      !apiHasEntities &&
      !graphReadyForProjection &&
      !graphSnapshotConverged
    ) {
      return degradedGuidance(initializationRecoveryMessage, workspace, operationalOnboarding);
    }

    try {
      const safe = safeOperationalProjection({
        payload: {
          graphReady: true,
          summary: snapshot.summary,
          funding: snapshot.funding,
          participants: snapshot.participants,
        },
        workspace,
        scope: options?.scope ?? (options?.project ? 'project' : 'workspace'),
        scopeTitle: options?.scopeTitle ?? act.phaseLabel,
        auditTimeline,
        operationalOnboarding: operationalOnboarding ?? undefined,
        fallbackGuidance: () => {
          if (hasPersistedTruth || apiHasEntities) {
            return guidanceFromOperationalGraph({
              snapshot,
              workspace,
              scope: options?.scope ?? (options?.project ? 'project' : 'workspace'),
              scopeTitle: options?.scopeTitle ?? act.phaseLabel,
              auditTimeline,
              graphReady: true,
              graphSnapshotConverged: true,
              initializationRecoveryMessage,
              operationalOnboarding: operationalOnboarding ?? undefined,
            });
          }
          return degradedGuidance(
            initializationRecoveryMessage,
            workspace,
            operationalOnboarding
          );
        },
      });
      return safe.guidance;
    } catch (error) {
      assertOperationalProjectionInvariants({
        projectionThrew: true,
        expectedInitializationWindow: !graphSnapshotConverged && !hasPersistedTruth,
      });
      console.error('[useOperationalGuidance] projection failed; degrading guidance', error);
      if (hasPersistedTruth || apiHasEntities) {
        return guidanceFromOperationalGraph({
          snapshot,
          workspace,
          scope: options?.scope ?? (options?.project ? 'project' : 'workspace'),
          scopeTitle: options?.scopeTitle ?? act.phaseLabel,
          auditTimeline,
          graphReady: true,
          graphSnapshotConverged: true,
          initializationRecoveryMessage,
          operationalOnboarding: operationalOnboarding ?? undefined,
        });
      }
      return degradedGuidance(initializationRecoveryMessage, workspace, operationalOnboarding);
    }
  }, [
    activation,
    auditTimeline,
    effectiveGraph,
    graphReadyForProjection,
    graphSnapshotConverged,
    hasPersistedTruth,
    initializationRecoveryMessage,
    operationalOnboarding,
    options?.scope,
    options?.scopeTitle,
    options?.project,
  ]);

  const appendAudit = React.useCallback((entry: OperationalAuditEntry | null | undefined) => {
    if (!entry) return;
    appendOperationalAuditEntry(entry);
  }, []);

  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { auditEntry?: OperationalAuditEntry };
      appendAudit(detail?.auditEntry);
    };
    window.addEventListener('operational-sync', handler);
    return () => window.removeEventListener('operational-sync', handler);
  }, [appendAudit]);

  const guidanceMemoDeps = React.useMemo(
    () =>
      [
        graphSnapshotConverged,
        hasPersistedTruth,
        effectiveGraph.summary?.participantCount,
        effectiveGraph.summary?.earningsConfiguredCount,
        effectiveGraph.summary?.payoutReadyCount,
        effectiveGraph.obligations?.length,
        loading,
        graphLoading,
      ].join('|'),
    [
      effectiveGraph,
      graphLoading,
      graphSnapshotConverged,
      hasPersistedTruth,
      loading,
    ]
  );

  React.useEffect(() => {
    traceOperationalRender({
      hook: 'useOperationalGuidance',
      phase: 'effect',
      surface: options?.scopeTitle ?? options?.scope,
      projectId,
      graphSnapshotConverged: hasPersistedTruth ? true : graphSnapshotConverged,
      degraded:
        hasPersistedTruth
          ? false
          : degraded ||
            guidance.degraded ||
            (!graphReadyForProjection && !graphSnapshotConverged),
      participantCount: effectiveGraph.summary?.participantCount,
      kpis: effectiveGraph.summary
        ? {
            participantCount: effectiveGraph.summary.participantCount,
            earningsConfiguredCount: effectiveGraph.summary.earningsConfiguredCount,
            payoutReadyCount: effectiveGraph.summary.payoutReadyCount,
            obligationCount: effectiveGraph.obligations?.length ?? 0,
          }
        : null,
      memoDeps: guidanceMemoDeps,
    });
  }, [
    degraded,
    effectiveGraph,
    graphReadyForProjection,
    graphSnapshotConverged,
    guidance.degraded,
    guidanceMemoDeps,
    hasPersistedTruth,
    options?.scope,
    options?.scopeTitle,
    projectId,
  ]);

  const apiHasEntitiesFromGraph =
    (effectiveGraph.summary?.participantCount ?? 0) > 0 ||
    (effectiveGraph.participants?.length ?? 0) > 0;

  const primaryAction = guidance.actions[0] ?? null;
  const nextRecommended =
    (graphSnapshotConverged || hasPersistedTruth) && primaryAction
      ? {
          id: primaryAction.id,
          title: primaryAction.action,
          description: primaryAction.reason,
          href: primaryAction.destination,
          ctaLabel: primaryAction.ctaLabel ?? 'Continue',
          blockers: guidance.explanation.blockers,
        }
      : nextAction ??
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
    graph: effectiveGraph,
    auditTimeline,
    nextAction: nextRecommended,
    loading: loading || graphLoading,
    degraded: hasPersistedTruth
      ? false
      : degraded ||
        guidance.degraded ||
        (!graphReadyForProjection && !graphSnapshotConverged && !apiHasEntitiesFromGraph),
    graphSnapshotConverged: hasPersistedTruth ? true : graphSnapshotConverged,
    operationalOnboarding,
    operationalInitialization,
    refresh: async () => {
      await Promise.all([refresh(), loadGraph()]);
    },
    reloadCoordinationSnapshot: loadGraph,
    appendAudit,
    workspaceContext: activation
      ? workspaceContextFromGraph(effectiveGraph as OperationalCoordinationSnapshot, {
          hasOrganization: activation.workspaceCreated,
          onboardingCompleted: activation.onboardingCompleted,
          projectCreated: activation.projectCreated,
          participantCount: Math.max(
            activation.participantCount,
            effectiveGraph.summary?.participantCount ?? 0
          ),
          participantsConfigured: activation.participantsConfigured,
          participantsConfiguredCount: Math.max(
            activation.participantsConfiguredCount,
            effectiveGraph.summary?.earningsConfiguredCount ?? 0
          ),
          obligationCount: effectiveGraph.obligations?.length ?? 0,
          paymentLinkCount: 0,
          collectionPreferenceDecideLater: !activation.revenueConfigured,
          defaultCurrency: activation.defaultCurrency,
          stripeConfigured: activation.providerConnected,
          wiseConfigured: false,
          hederaConfigured: false,
          releaseEligibleCount: effectiveGraph.summary?.releaseReadyCount ?? 0,
          releaseBatchCount: activation.firstReleaseCompleted ? 1 : 0,
          primaryProjectId: activation.primaryProjectId,
        })
      : defaultWorkspaceContext(),
  };
}

export function dispatchOperationalAudit(entry: OperationalAuditEntry): void {
  dispatchOperationalEvent({
    type: 'SYNCHRONIZATION_COMPLETED',
    timestamp: entry.timestamp,
    source: 'client',
    projectId: entry.projectId,
    participantId: entry.participantId,
    payload: { auditEntry: entry },
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('operational-sync', { detail: { auditEntry: entry } }));
  }
}
