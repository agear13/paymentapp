import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { WorkspaceActivationInput } from '@/lib/onboarding/workspace-activation-state';
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
import { explainWorkspaceState } from '@/lib/operations/explainability/state-explanations';
import { safeEventProjection } from '@/lib/operations/timeline/safe-event-projection';
import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import { emptyOperationalGraphFunding, emptyOperationalGraphSummary } from '@/lib/operations/selectors/operational-coordination-snapshot';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import { PLATFORM_FALLBACK_CURRENCY } from '@/lib/currency/resolve-operational-workspace-currency';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';
import { assertOnboardingGraphInvariants } from '@/lib/operations/dev/operational-invariants';
import type { OperationalOnboardingState } from '@/lib/operations/onboarding/operational-onboarding-phases';

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
  snapshot: OperationalCoordinationSnapshot
): ActivationChecklistItem[] {
  const provider =
    input.stripeConfigured || input.wiseConfigured || input.hederaConfigured;
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
      complete: input.participantsConfigured,
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
  const summary = projectableSummary(snapshot);
  const { phase, label } = mapGraphPhase(snapshot);
  const provider =
    input.stripeConfigured || input.wiseConfigured || input.hederaConfigured;
  const revenue =
    provider ||
    input.paymentLinkCount > 0 ||
    !input.collectionPreferenceDecideLater;

  const blockers = summary.allBlockers.map((b) => b.explanation);
  const fundingState = deriveCanonicalFundingLifecycle(projectableFunding(snapshot).stage);
  const fundingBlocker = fundingLifecycleBlocker(fundingState);
  if (fundingBlocker && !blockers.includes(fundingBlocker)) {
    blockers.push(fundingBlocker);
  }

  const progress =
    summary.participantCount === 0
      ? 10
      : Math.min(
          100,
          Math.round(
            ((summary.payoutReadyCount / Math.max(1, summary.participantCount)) *
              50 +
              (summary.releaseReadyCount > 0 ? 50 : snapshot.obligations.length > 0 ? 25 : 0))
          )
        );

  return {
    workspaceCreated: input.hasOrganization,
    projectCreated: input.projectCreated,
    participantCount: input.participantCount,
    participantsConfigured: input.participantsConfigured,
    participantsConfiguredCount: input.participantsConfiguredCount,
    obligationsCreated: snapshot.obligations.length > 0,
    obligationCount: snapshot.obligations.length,
    revenueConfigured: revenue,
    providerConnected: provider,
    payoutMethodConfigured: provider,
    releaseEligible: summary.releaseReadyCount > 0,
    releaseEligibleCount: summary.releaseReadyCount,
    firstReleaseCompleted: input.releaseBatchCount > 0,
    onboardingCompleted: input.onboardingCompleted,
    defaultCurrency: input.defaultCurrency,
    onboardingProgressPercent: progress,
    phase,
    phaseLabel: label,
    checklist: buildChecklist(input, snapshot),
    activationBlockers: blockers,
    setupWarnings: [],
    primaryProjectId: input.primaryProjectId,
    needsGuidance: blockers.length > 0 || summary.releaseReadyCount === 0,
    degraded: false,
  };
}

export function workspaceContextFromGraph(
  snapshot: OperationalCoordinationSnapshot,
  input: WorkspaceActivationInput
): WorkspaceOperationalContext {
  const summary = projectableSummary(snapshot);
  const provider =
    input.stripeConfigured || input.wiseConfigured || input.hederaConfigured;
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
    obligationCount: snapshot.obligations.length,
    paymentLinkCount: input.paymentLinkCount,
    collectionPreferenceDecideLater: input.collectionPreferenceDecideLater,
    releaseEligibleCount: summary.releaseReadyCount,
    releaseBatchCount: input.releaseBatchCount,
  };
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

  const fundingState = deriveCanonicalFundingLifecycle(funding.stage);

  const timelineProjection = safeEventProjection({
    auditTimeline: input.auditTimeline,
    workspace: input.workspace,
    graphSnapshotConverged: input.graphSnapshotConverged ?? input.graphReady ?? true,
  });

  const timeline: TimelineEvent[] = timelineProjection.degraded
    ? (input.auditTimeline ?? []).map((e) => ({
        id: e.id,
        type: 'state_transition' as const,
        title: e.title,
        description: e.description,
        timestamp: e.timestamp,
        completed: true,
      }))
    : timelineProjection.timeline;

  const eventBlockerBullets = timelineProjection.blockers.map((b) => b.reason);
  if (eventBlockerBullets.length > 0) {
    explanation.blockers = [...new Set([...eventBlockerBullets, ...explanation.blockers])];
  }

  const releaseConfidence: ReleaseConfidenceSnapshot = {
    level: timelineProjection.confidence.level,
    score: timelineProjection.confidence.score,
    currency: input.workspace.defaultCurrency ?? PLATFORM_FALLBACK_CURRENCY,
    collectedRevenue: 0,
    reservedObligations: input.snapshot.obligations.length,
    readyToRelease: summary.releaseReadyCount,
    heldBack: Math.max(
      0,
      summary.participantCount - summary.releaseReadyCount
    ),
    heldBackReasons: explanation.blockers,
    blockedParticipantCount: input.snapshot.participants.filter(
      (p) => !p.readinessHierarchy?.release?.ready
    ).length,
    riskWarnings: [],
    releasableObligationCount: input.snapshot.obligations.filter(
      (o) => o.operational?.releaseReady
    ).length,
    totalObligationCount: input.snapshot.obligations.length,
    explainability: {
      headline: timelineProjection.confidence.explainability.headline,
      bullets: [
        ...timelineProjection.confidence.explainability.bullets,
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
        releaseBlockers: blocking.detailedBlockers,
        graphReady: input.graphReady ?? true,
        graphSnapshotConverged: input.graphSnapshotConverged ?? input.graphReady ?? true,
        operationalOnboarding: input.operationalOnboarding,
      })
    ),
    trustSignals: deriveTrustSignals({ workspace: input.workspace }),
    releaseConfidence,
    releaseBlockers: blocking.detailedBlockers,
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
