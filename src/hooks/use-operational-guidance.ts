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
  workspaceContextFromGraph,
} from '@/lib/operations/selectors/operational-graph-adapter';
import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import { parseCoordinationSnapshotProjection } from '@/lib/operations/selectors/operational-coordination-snapshot';
import { useWorkspaceActivation } from '@/hooks/use-workspace-activation';
import { createFallbackActivation } from '@/lib/onboarding/workspace-activation-fallback';
import { defaultWorkspaceContext } from '@/lib/operations/types/operational-context';
import type { OperationalOnboardingState } from '@/lib/operations/onboarding/operational-onboarding-phases';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';
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

export type OperationalGuidanceOptions = {
  enabled?: boolean;
  scope?: 'workspace' | 'project';
  scopeTitle?: string;
  project?: RecentDeal | null;
  participants?: DemoParticipant[];
  treasury?: ProjectTreasurySummary | null;
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

  React.useEffect(() => {
    if (!graphReadyForProjection) {
      setGraphSnapshotConverged(false);
    }
  }, [graphReadyForProjection]);

  const loadGraph = React.useCallback(async () => {
    if (options?.enabled === false) return;
    if (!graphReadyForProjection) {
      setGraph(emptyGraph());
      setGraphSnapshotConverged(false);
      return;
    }
    setGraphLoading(true);
    try {
      const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
      const res = await fetch(`/api/operations/coordination-snapshot${qs}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!res.ok) {
        setGraphSnapshotConverged(false);
        return;
      }
      const json = (await res.json()) as {
        data?: {
          graphReady?: boolean;
          summary: GraphSummary['summary'] | null;
          funding: GraphSummary['funding'] | null;
          participants: GraphSummary['participants'];
          obligationCount: number;
          auditTimeline?: OperationalAuditEntry[];
        };
      };
      if (!json.data) {
        setGraphSnapshotConverged(false);
        return;
      }
      const projection = parseCoordinationSnapshotProjection({
        graphReady: json.data.graphReady,
        summary: json.data.summary,
        funding: json.data.funding,
        participants: json.data.participants as GraphSummary['participants'],
      });
      if (!projection || json.data.graphReady !== true) {
        setGraph(emptyGraph());
        setGraphSnapshotConverged(false);
        return;
      }
      if (json.data.auditTimeline?.length) {
        setOperationalAuditEntries(json.data.auditTimeline);
      }
      setGraph(projection);
      setGraphSnapshotConverged(true);
    } finally {
      setGraphLoading(false);
    }
  }, [options?.enabled, projectId, graphReadyForProjection]);

  React.useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  React.useEffect(() => {
    if (!projectId) return;
    return subscribeProjectOperationalEvents(projectId, {
      invalidate: () => undefined,
      refreshSilent: async () => {
        await loadGraph();
        await refresh();
      },
      onAudit: appendOperationalAuditEntry,
    });
  }, [projectId, loadGraph, refresh]);

  const initializationRecoveryMessage =
    operationalOnboarding?.recoveryMessage ?? operationalInitialization?.onboarding.recoveryMessage;

  const guidance = React.useMemo((): OperationalGuidanceBundle => {
    const act = activation ?? createFallbackActivation();
    const workspace = activation
      ? workspaceContextFromGraph(graph as OperationalCoordinationSnapshot, {
          hasOrganization: act.workspaceCreated,
          onboardingCompleted: act.onboardingCompleted,
          projectCreated: act.projectCreated,
          participantCount: act.participantCount,
          participantsConfigured: act.participantsConfigured,
          participantsConfiguredCount: act.participantsConfiguredCount,
          obligationCount: graph.obligations?.length ?? 0,
          paymentLinkCount: 0,
          collectionPreferenceDecideLater: !act.revenueConfigured,
          defaultCurrency: act.defaultCurrency,
          stripeConfigured: act.providerConnected,
          wiseConfigured: false,
          hederaConfigured: false,
          releaseEligibleCount: graph.summary?.releaseReadyCount ?? 0,
          releaseBatchCount: act.firstReleaseCompleted ? 1 : 0,
          primaryProjectId: act.primaryProjectId,
        })
      : defaultWorkspaceContext();

    if (!graphReadyForProjection || !graphSnapshotConverged) {
      return degradedGuidance(initializationRecoveryMessage, workspace, operationalOnboarding);
    }

    try {
      const safe = safeOperationalProjection({
        payload: {
          graphReady: true,
          summary: graph.summary,
          funding: graph.funding,
          participants: graph.participants,
        },
        workspace,
        scope: options?.scope ?? (options?.project ? 'project' : 'workspace'),
        scopeTitle: options?.scopeTitle ?? act.phaseLabel,
        auditTimeline,
        operationalOnboarding: operationalOnboarding ?? undefined,
        fallbackGuidance: () =>
          degradedGuidance(initializationRecoveryMessage, workspace, operationalOnboarding),
      });
      return safe.guidance;
    } catch (error) {
      assertOperationalProjectionInvariants({
        projectionThrew: true,
        expectedInitializationWindow: !graphSnapshotConverged,
      });
      console.error('[useOperationalGuidance] projection failed; degrading guidance', error);
      return degradedGuidance(initializationRecoveryMessage, workspace, operationalOnboarding);
    }
  }, [
    activation,
    auditTimeline,
    graph,
    graphReadyForProjection,
    graphSnapshotConverged,
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

  const primaryAction = guidance.actions[0] ?? null;
  const nextRecommended =
    graphSnapshotConverged && primaryAction
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
    graph,
    auditTimeline,
    nextAction: nextRecommended,
    loading: loading || graphLoading,
    degraded:
      degraded ||
      guidance.degraded ||
      !graphReadyForProjection ||
      !graphSnapshotConverged,
    graphSnapshotConverged,
    operationalOnboarding,
    operationalInitialization,
    refresh: async () => {
      await Promise.all([refresh(), loadGraph()]);
    },
    appendAudit,
    workspaceContext: activation
      ? workspaceContextFromGraph(graph as OperationalCoordinationSnapshot, {
          hasOrganization: activation.workspaceCreated,
          onboardingCompleted: activation.onboardingCompleted,
          projectCreated: activation.projectCreated,
          participantCount: activation.participantCount,
          participantsConfigured: activation.participantsConfigured,
          participantsConfiguredCount: activation.participantsConfiguredCount,
          obligationCount: graph.summary.participantCount,
          paymentLinkCount: 0,
          collectionPreferenceDecideLater: !activation.revenueConfigured,
          defaultCurrency: activation.defaultCurrency,
          stripeConfigured: activation.providerConnected,
          wiseConfigured: false,
          hederaConfigured: false,
          releaseEligibleCount: graph.summary.releaseReadyCount,
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
