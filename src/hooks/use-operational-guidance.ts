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
import { useWorkspaceActivation } from '@/hooks/use-workspace-activation';
import { createFallbackActivation } from '@/lib/onboarding/workspace-activation-fallback';
import { defaultWorkspaceContext } from '@/lib/operations/types/operational-context';
import type { OperationalOnboardingState } from '@/lib/operations/onboarding/operational-onboarding-phases';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';
import { deriveOperationalReleaseBlockers } from '@/lib/operations/explainability/derive-operational-release-blockers';
import { subscribeProjectOperationalEvents } from '@/lib/operations/orchestration/operational-sync-client';
import { dispatchOperationalEvent } from '@/lib/operations/orchestration/operational-event-bus';

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
  return {
    summary: {
      participantCount: 0,
      payoutReadyCount: 0,
      releaseReadyCount: 0,
      blockerCount: 0,
      allBlockers: [],
    },
    funding: { allocated: false, stage: null },
    participants: [],
    obligations: [],
  };
}

function isGraphReadyForProjection(onboarding: OperationalOnboardingState | null | undefined): boolean {
  if (!onboarding) return false;
  return onboarding.graphReady === true || onboarding.phase === 'OPERATIONAL_GRAPH_READY';
}

function degradedGuidance(recoveryMessage?: string | null): OperationalGuidanceBundle {
  const releaseBlockers = deriveOperationalReleaseBlockers({
    snapshot: {
      participants: [],
      obligations: [],
      summary: {
        participantCount: 0,
        payoutReadyCount: 0,
        releaseReadyCount: 0,
        blockerCount: 1,
        allBlockers: [],
      },
      funding: { allocated: false, stage: null },
    },
    graphReady: false,
    initializationRecoveryMessage: recoveryMessage,
  });
  const primary = releaseBlockers[0];
  const headline = primary?.reason ?? 'Operational coordination initializing';
  const remediation =
    primary?.remediation ??
    'Your payment rails were connected successfully. Operational coordination is being prepared.';

  return {
    explanation: {
      readinessLevel: 'blocked',
      readinessScore: 0,
      blockers: [headline],
      warnings: [],
      missingRequirements: [],
      confidence: 'BLOCKED',
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
        headline: 'Operational coordination initializing',
        bullets: [headline, remediation],
      },
      trustState: 'attention',
      phaseLabel: 'Settlement infrastructure initializing',
      scopeTitle: 'Workspace',
    },
    stateExplanation: null,
    actions: [],
    trustSignals: [],
    releaseBlockers,
    releaseConfidence: {
      level: 'BLOCKED',
      score: 0,
      currency: 'AUD',
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
  const graphReadyForProjection =
    isGraphReadyForProjection(operationalOnboarding) ||
    operationalInitialization?.graphReady === true;
  const projectId = options?.project?.id ?? activation?.primaryProjectId ?? null;
  const [graph, setGraph] = React.useState<GraphSummary>(emptyGraph);
  const auditTimeline = useOperationalAuditStore({
    projectId: projectId ?? undefined,
  });
  const [graphLoading, setGraphLoading] = React.useState(false);

  const loadGraph = React.useCallback(async () => {
    if (options?.enabled === false) return;
    if (!graphReadyForProjection) {
      setGraph(emptyGraph());
      return;
    }
    setGraphLoading(true);
    try {
      const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
      const res = await fetch(`/api/operations/coordination-snapshot${qs}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!res.ok) return;
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
      if (!json.data) return;
      const projection = parseCoordinationSnapshotProjection({
        graphReady: json.data.graphReady,
        summary: json.data.summary,
        funding: json.data.funding,
        participants: json.data.participants as GraphSummary['participants'],
      });
      if (!projection) {
        setGraph(emptyGraph());
        return;
      }
      if (json.data.auditTimeline?.length) {
        setOperationalAuditEntries(json.data.auditTimeline);
      }
      setGraph(projection);
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

  const guidance = React.useMemo((): OperationalGuidanceBundle => {
    if (!graphReadyForProjection) {
      return degradedGuidance(
        operationalOnboarding?.recoveryMessage ?? operationalInitialization?.onboarding.recoveryMessage
      );
    }

    const act = activation ?? createFallbackActivation();
    const snapshot = graph as OperationalCoordinationSnapshot;
    const workspace = workspaceContextFromGraph(snapshot, {
      hasOrganization: act.workspaceCreated,
      onboardingCompleted: act.onboardingCompleted,
      projectCreated: act.projectCreated,
      participantCount: act.participantCount,
      participantsConfigured: act.participantsConfigured,
      participantsConfiguredCount: act.participantsConfiguredCount,
      obligationCount: snapshot.obligations.length,
      paymentLinkCount: 0,
      collectionPreferenceDecideLater: !act.revenueConfigured,
      defaultCurrency: act.defaultCurrency,
      stripeConfigured: act.providerConnected,
      wiseConfigured: false,
      hederaConfigured: false,
      releaseEligibleCount: snapshot.summary.releaseReadyCount,
      releaseBatchCount: act.firstReleaseCompleted ? 1 : 0,
      primaryProjectId: act.primaryProjectId,
    });

    return guidanceFromOperationalGraph({
      snapshot,
      workspace,
      scope: options?.scope ?? (options?.project ? 'project' : 'workspace'),
      scopeTitle: options?.scopeTitle ?? act.phaseLabel,
      auditTimeline,
    });
  }, [
    activation,
    auditTimeline,
    graph,
    graphReadyForProjection,
    operationalInitialization?.onboarding.recoveryMessage,
    operationalOnboarding?.recoveryMessage,
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
    graph,
    auditTimeline,
    nextAction: nextRecommended,
    loading: loading || graphLoading,
    degraded:
      degraded ||
      guidance.degraded ||
      !graphReadyForProjection,
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
