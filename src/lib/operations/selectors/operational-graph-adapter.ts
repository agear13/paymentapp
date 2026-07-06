import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { WorkspaceActivationInput } from '@/lib/onboarding/workspace-activation-state';
import { resolveAnyRailConfigured } from '@/lib/onboarding/workspace-activation-state';
import type {
  ActivationChecklistItem,
  WorkspaceActivationPhase,
  WorkspaceActivationSnapshot,
} from '@/lib/onboarding/workspace-activation-types';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import {
  deriveCanonicalFundingLifecycle,
  fundingLifecycleBlocker,
  fundingLifecycleLabel,
} from '@/lib/operations/contracts/funding-lifecycle';
import { deriveTrustSignals } from '@/lib/operations/explainability/trust-signals';
import type { ReleaseConfidenceSnapshot, TimelineEvent, OperationalExplainability, OperationalGuidanceBundle } from '@/lib/operations/explainability/types';
import { deduplicateOperationalActions } from '@/lib/operations/explainability/deduplicate-operational-actions';
import { deriveNextOperationalActions } from '@/lib/operations/explainability/derive-next-operational-actions';
import { deriveOperationalNextActions } from '@/lib/operations/explainability/derive-operational-next-actions';
import { deriveOperationalBlockingActions } from '@/lib/operations/explainability/derive-operational-blocking-actions';
import { deduplicateReleaseBlockers } from '@/lib/operations/explainability/derive-operational-release-blockers';
import { explainWorkspaceState } from '@/lib/operations/explainability/state-explanations';
import { safeEventProjection } from '@/lib/operations/timeline/safe-event-projection';
import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import { emptyOperationalGraphFunding, emptyOperationalGraphSummary } from '@/lib/operations/selectors/operational-coordination-snapshot';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import { PLATFORM_FALLBACK_CURRENCY } from '@/lib/currency/resolve-operational-workspace-currency';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';
import {
  assertOnboardingGraphInvariants,
  assertParticipantKpiConvergenceInvariants,
} from '@/lib/operations/dev/operational-invariants';
import type { OperationalOnboardingState } from '@/lib/operations/onboarding/operational-onboarding-phases';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import {
  buildCanonicalStateFromSnapshot,
  workspaceContextFromCanonicalState,
  activationFromCanonicalState,
} from '@/lib/operations/reducer/adapters/legacy-selectors';

function projectableSummary(snapshot: OperationalCoordinationSnapshot) {
  if (snapshot.summary == null) {
    assertOnboardingGraphInvariants({ graphSummaryConsumedBeforeReady: true });
    return emptyOperationalGraphSummary();
  }
  return snapshot.summary;
}

function projectableFunding(snapshot: OperationalCoordinationSnapshot) {
  if (snapshot.funding == null) {
    assertOnboardingGraphInvariants({ graphSummaryConsumedBeforeReady: true });
    return emptyOperationalGraphFunding();
  }
  return snapshot.funding;
}

function mapGraphPhase(snapshot: OperationalCoordinationSnapshot): {
  phase: WorkspaceActivationPhase;
  label: string;
} {
  const summary = projectableSummary(snapshot);
  const blocking = deriveOperationalBlockingActions(snapshot);
  if (blocking.blockers.length > 0) {
    return { phase: 'ready_to_coordinate', label: 'Coordination blocked' };
  }
  if (summary.releaseReadyCount > 0) {
    return { phase: 'ready_for_release', label: 'Ready for payout release' };
  }
  if (snapshot.obligations.length > 0 || summary.payoutReadyCount > 0) {
    return { phase: 'ready_to_coordinate', label: 'Ready to coordinate payouts' };
  }
  if (summary.participantCount > 0) {
    return { phase: 'setup_in_progress', label: 'Workspace setup in progress' };
  }
  return { phase: 'setup_in_progress', label: 'Workspace setup in progress' };
}

function buildChecklist(
  input: WorkspaceActivationInput,
  snapshot: OperationalCoordinationSnapshot,
  payoutSummary: OperationalKPIs
): ActivationChecklistItem[] {
  const provider = resolveAnyRailConfigured(input);
  const revenue =
    provider ||
    input.paymentLinkCount > 0 ||
    !input.collectionPreferenceDecideLater;
  const fundingState = deriveCanonicalFundingLifecycle(projectableFunding(snapshot).stage);
  return [
    { id: 'workspace', label: 'Workspace created', complete: input.hasOrganization },
    { id: 'project', label: 'First project created', complete: input.projectCreated },
    { id: 'participants', label: 'Participants added', complete: input.participantCount > 0 },
    {
      id: 'compensation',
      label: 'Participant compensation configured',
      complete: payoutSummary.participantsConfigured,
    },
    { id: 'provider', label: 'Payment provider connected', complete: provider },
    { id: 'revenue', label: 'Revenue collection ready', complete: revenue },
    {
      id: 'obligations',
      label: 'Obligations tracked',
      complete: snapshot.obligations.length > 0,
    },
    {
      id: 'funding',
      label: fundingLifecycleLabel(fundingState),
      complete: fundingState === 'RELEASE_FUNDED' || fundingState === 'RELEASED',
    },
    {
      id: 'release',
      label: 'First payout release completed',
      complete: input.releaseBatchCount > 0,
    },
  ];
}

/** Adapter: operational graph → legacy activation snapshot (UI compatibility). */
export function activationFromOperationalGraph(
  snapshot: OperationalCoordinationSnapshot,
  input: WorkspaceActivationInput
): WorkspaceActivationSnapshot {
  const canonical = buildCanonicalStateFromSnapshot(snapshot, { activation: input });
  const activation = activationFromCanonicalState(canonical, input);
  const { phase, label } = mapGraphPhase(snapshot);
  return {
    ...activation,
    phase,
    phaseLabel: label,
    checklist: buildChecklist(input, snapshot, canonical.kpis),
    obligationCount: Math.max(snapshot.obligations.length, canonical.kpis.obligationCount),
    obligationsCreated:
      snapshot.obligations.length > 0 || canonical.kpis.obligationCount > 0,
  };
}

export function workspaceContextFromGraph(
  snapshot: OperationalCoordinationSnapshot,
  input: WorkspaceActivationInput
): WorkspaceOperationalContext {
  const canonical = buildCanonicalStateFromSnapshot(snapshot, { activation: input });
  const summary = projectableSummary(snapshot);
  const kpis = canonical.kpis;

  assertParticipantKpiConvergenceInvariants({
    participantRowsWithCompensation: kpis.earningsConfiguredCount,
    workspaceEarningsConfiguredCount: kpis.earningsConfiguredCount,
    graphEarningsConfiguredCount: summary.earningsConfiguredCount,
    payoutReadyCount: kpis.payoutReadyCount,
    graphPayoutReadyCount: summary.payoutReadyCount,
  });

  return workspaceContextFromCanonicalState(canonical, input);
}

function explainabilityFromGraph(
  snapshot: OperationalCoordinationSnapshot,
  scopeTitle: string,
  workspace?: WorkspaceOperationalContext
): OperationalExplainability {
  const summary = projectableSummary(snapshot);
  const blocking = deriveOperationalBlockingActions(snapshot, workspace);
  const blockers = blocking.blockers.map((b) => b.explanation);
  const missing: string[] = [];
  for (const p of snapshot.participants) {
    if (!p.readinessHierarchy?.participant?.ready) {
      missing.push(...(p.readinessHierarchy?.participant?.blockers ?? []));
    }
    if (!p.readinessHierarchy?.obligation?.ready) {
      missing.push(...(p.readinessHierarchy?.obligation?.blockers ?? []));
    }
  }

  const readinessLevel =
    blockers.length > 0
      ? 'blocked'
      : summary.releaseReadyCount > 0
        ? 'ready'
        : 'partial';

  return {
    readinessLevel,
    readinessScore:
      summary.participantCount === 0
        ? 0
        : Math.round(
            (summary.releaseReadyCount / Math.max(1, summary.participantCount)) *
              100
          ),
    blockers,
    warnings: blocking.warnings,
    missingRequirements: [...new Set(missing)].slice(0, 8),
    confidence:
      blockers.length > 0
        ? 'BLOCKED'
        : summary.releaseReadyCount > 0
          ? 'HIGH'
          : 'MEDIUM',
    nextRecommendedActions: blocking.nextActions.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      href: a.href ?? '#',
      ctaLabel: a.ctaLabel ?? 'Continue',
      priority: 1,
    })),
    explainability: blocking.readinessExplanation,
    trustState: blockers.length > 0 ? 'attention' : 'healthy',
    phaseLabel: mapGraphPhase(snapshot).label,
    scopeTitle,
  };
}

/** Adapter: operational graph → guidance bundle (replaces parallel explainability stack). */
export function guidanceFromOperationalGraph(input: {
  snapshot: OperationalCoordinationSnapshot;
  workspace: WorkspaceOperationalContext;
  scope?: 'workspace' | 'project';
  scopeTitle?: string;
  auditTimeline?: OperationalAuditEntry[];
  graphReady?: boolean;
  graphSnapshotConverged?: boolean;
  initializationRecoveryMessage?: string | null;
  operationalOnboarding?: OperationalOnboardingState | null;
}): OperationalGuidanceBundle {
  const summary = projectableSummary(input.snapshot);
  const funding = projectableFunding(input.snapshot);
  const scope = input.scope ?? 'workspace';
  const explanation = explainabilityFromGraph(
    input.snapshot,
    input.scopeTitle ?? (scope === 'project' ? 'Project' : 'Workspace'),
    input.workspace
  );
  const blocking = deriveOperationalBlockingActions(input.snapshot, input.workspace, {
    graphReady: input.graphReady ?? true,
    initializationRecoveryMessage: input.initializationRecoveryMessage,
  });

  const canonical = buildCanonicalStateFromSnapshot(input.snapshot, {
    activation: {
      hasOrganization: input.workspace.hasOrganization,
      onboardingCompleted: input.workspace.onboardingCompleted,
      projectCreated: input.workspace.projectCount > 0,
      participantCount: input.workspace.participantCount,
      participantsConfigured:
        input.workspace.participantsConfiguredCount >= input.workspace.participantCount,
      participantsConfiguredCount: input.workspace.participantsConfiguredCount,
      obligationCount: input.workspace.obligationCount,
      paymentLinkCount: input.workspace.paymentLinkCount,
      collectionPreferenceDecideLater: input.workspace.collectionPreferenceDecideLater,
      defaultCurrency: input.workspace.defaultCurrency,
      stripeConfigured: input.workspace.stripeConfigured,
      wiseConfigured: input.workspace.wiseConfigured,
      hederaConfigured: input.workspace.hederaConfigured,
      evmWalletConfigured: input.workspace.evmWalletConfigured,
      anyRailConfigured: input.workspace.anyRailConfigured,
      releaseEligibleCount: input.workspace.releaseEligibleCount,
      releaseBatchCount: input.workspace.releaseBatchCount,
      primaryProjectId: input.workspace.primaryProjectId ?? null,
    },
    auditTimeline: input.auditTimeline,
    graphReady: input.graphReady,
    graphSnapshotConverged: input.graphSnapshotConverged,
  });

  const releaseBlockers = deduplicateReleaseBlockers(
    canonical.blockers.length > 0 ? canonical.blockers : blocking.detailedBlockers
  );

  const fundingState = deriveCanonicalFundingLifecycle(funding.stage);

  const timelineProjection = safeEventProjection({
    auditTimeline: input.auditTimeline,
    workspace: input.workspace,
    graphSnapshotConverged: input.graphSnapshotConverged ?? input.graphReady ?? true,
  });

  const timeline: TimelineEvent[] =
    canonical.timeline.length > 0
      ? canonical.timeline
      : timelineProjection.degraded
        ? (input.auditTimeline ?? []).map((e) => ({
            id: e.id,
            type: 'state_transition' as const,
            title: e.title,
            description: e.description,
            timestamp: e.timestamp,
            completed: true,
          }))
        : timelineProjection.timeline;

  if (canonical.blockers.length > 0) {
    explanation.blockers = canonical.blockers.map((b) => b.reason);
  }

  const releaseConfidence: ReleaseConfidenceSnapshot = {
    level: canonical.confidence.level,
    score: canonical.confidence.score,
    currency: input.workspace.defaultCurrency ?? PLATFORM_FALLBACK_CURRENCY,
    collectedRevenue: 0,
    reservedObligations: canonical.kpis.obligationCount,
    readyToRelease: canonical.kpis.releaseEligibleCount,
    heldBack: Math.max(0, canonical.kpis.participantCount - canonical.kpis.releaseEligibleCount),
    heldBackReasons: explanation.blockers,
    blockedParticipantCount: canonical.participants.filter(
      (p) => !p.releaseReadiness.releaseReady
    ).length,
    riskWarnings: [],
    releasableObligationCount: canonical.obligations.filter(
      (o) => o.obligation.operational.releaseReady
    ).length,
    totalObligationCount: canonical.kpis.obligationCount,
    explainability: {
      headline: canonical.confidence.explainability.headline,
      bullets: [
        ...canonical.confidence.explainability.bullets,
        ...explanation.explainability.bullets,
      ],
    },
  };

  return {
    explanation,
    stateExplanation: explainWorkspaceState(
      summary.releaseReadyCount > 0 ? 'ACTIVE' : 'CONFIGURING',
      explanation.blockers
    ),
    actions: deduplicateOperationalActions(
      deriveOperationalNextActions({
        explanation,
        workspace: input.workspace,
        releaseBlockers,
        graphReady: input.graphReady ?? true,
        graphSnapshotConverged: input.graphSnapshotConverged ?? input.graphReady ?? true,
        operationalOnboarding: input.operationalOnboarding,
      })
    ),
    trustSignals: deriveTrustSignals({ workspace: input.workspace }),
    releaseConfidence,
    releaseBlockers,
    timeline,
    transition: null,
    degraded: false,
  };
}

export function projectParticipantsReadyFromGraph(
  snapshot: OperationalCoordinationSnapshot,
  deal: RecentDeal,
  participants: DemoParticipant[]
): { releaseReadyCount: number; payoutReadyCount: number; participantCount: number } {
  const dealIds = new Set(
    participants.filter((p) => p.dealId === deal.id || p.dealName === deal.dealName).map((p) => p.id)
  );
  const scoped = snapshot.participants.filter((p) => {
    const participantId = p.participant?.id;
    return participantId != null && dealIds.has(participantId);
  });
  return {
    releaseReadyCount: scoped.filter((p) => p.readinessHierarchy?.release?.ready).length,
    payoutReadyCount: scoped.filter((p) => p.payoutReadiness?.payoutReady).length,
    participantCount: scoped.length,
  };
}

export function treasuryFundingLabelFromGraph(
  snapshot: OperationalCoordinationSnapshot
): { fundingLabel: string; fundingSubcopy: string } {
  const funding = projectableFunding(snapshot);
  const state = deriveCanonicalFundingLifecycle(funding.stage);
  const blocker = fundingLifecycleBlocker(state);
  return {
    fundingLabel: fundingLifecycleLabel(state),
    fundingSubcopy: blocker ?? 'Funding coordination is on track.',
  };
}
