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
import { explainWorkspaceState } from '@/lib/operations/explainability/state-explanations';
import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';

function mapGraphPhase(snapshot: OperationalCoordinationSnapshot): {
  phase: WorkspaceActivationPhase;
  label: string;
} {
  if (snapshot.summary.releaseReadyCount > 0) {
    return { phase: 'ready_for_release', label: 'Ready for payout release' };
  }
  if (snapshot.obligations.length > 0 || snapshot.summary.payoutReadyCount > 0) {
    return { phase: 'ready_to_coordinate', label: 'Ready to coordinate payouts' };
  }
  if (snapshot.summary.participantCount > 0) {
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
  const fundingState = deriveCanonicalFundingLifecycle(snapshot.funding.stage);
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
  const { phase, label } = mapGraphPhase(snapshot);
  const provider =
    input.stripeConfigured || input.wiseConfigured || input.hederaConfigured;
  const revenue =
    provider ||
    input.paymentLinkCount > 0 ||
    !input.collectionPreferenceDecideLater;

  const blockers = snapshot.summary.allBlockers.map((b) => b.explanation);
  const fundingState = deriveCanonicalFundingLifecycle(snapshot.funding.stage);
  const fundingBlocker = fundingLifecycleBlocker(fundingState);
  if (fundingBlocker && !blockers.includes(fundingBlocker)) {
    blockers.push(fundingBlocker);
  }

  const progress =
    snapshot.summary.participantCount === 0
      ? 10
      : Math.min(
          100,
          Math.round(
            ((snapshot.summary.payoutReadyCount / Math.max(1, snapshot.summary.participantCount)) *
              50 +
              (snapshot.summary.releaseReadyCount > 0 ? 50 : snapshot.obligations.length > 0 ? 25 : 0))
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
    releaseEligible: snapshot.summary.releaseReadyCount > 0,
    releaseEligibleCount: snapshot.summary.releaseReadyCount,
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
    needsGuidance: blockers.length > 0 || snapshot.summary.releaseReadyCount === 0,
    degraded: false,
  };
}

export function workspaceContextFromGraph(
  snapshot: OperationalCoordinationSnapshot,
  input: WorkspaceActivationInput
): WorkspaceOperationalContext {
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
    releaseEligibleCount: snapshot.summary.releaseReadyCount,
    releaseBatchCount: input.releaseBatchCount,
  };
}

function explainabilityFromGraph(
  snapshot: OperationalCoordinationSnapshot,
  scopeTitle: string
): OperationalExplainability {
  const blockers = snapshot.summary.allBlockers.map((b) => b.explanation);
  const missing: string[] = [];
  for (const p of snapshot.participants) {
    if (!p.readinessHierarchy.participant.ready) {
      missing.push(...p.readinessHierarchy.participant.blockers);
    }
    if (!p.readinessHierarchy.obligation.ready) {
      missing.push(...p.readinessHierarchy.obligation.blockers);
    }
  }

  const readinessLevel =
    snapshot.summary.releaseReadyCount > 0
      ? 'ready'
      : blockers.length > 0
        ? 'blocked'
        : 'partial';

  return {
    readinessLevel,
    readinessScore:
      snapshot.summary.participantCount === 0
        ? 0
        : Math.round(
            (snapshot.summary.releaseReadyCount / Math.max(1, snapshot.summary.participantCount)) *
              100
          ),
    blockers,
    warnings: [],
    missingRequirements: [...new Set(missing)].slice(0, 8),
    confidence: snapshot.summary.releaseReadyCount > 0 ? 'HIGH' : blockers.length > 0 ? 'BLOCKED' : 'MEDIUM',
    nextRecommendedActions: [],
    explainability: {
      headline:
        blockers.length > 0
          ? 'Release blocked because:'
          : snapshot.summary.releaseReadyCount > 0
            ? 'Ready for payout release'
            : 'Coordination in progress',
      bullets: blockers.length > 0 ? blockers : ['Continue configuring participants and funding'],
    },
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
}): OperationalGuidanceBundle {
  const scope = input.scope ?? 'workspace';
  const explanation = explainabilityFromGraph(
    input.snapshot,
    input.scopeTitle ?? (scope === 'project' ? 'Project' : 'Workspace')
  );

  const fundingState = deriveCanonicalFundingLifecycle(input.snapshot.funding.stage);

  const releaseConfidence: ReleaseConfidenceSnapshot = {
    level: explanation.confidence,
    score: explanation.readinessScore,
    currency: input.workspace.defaultCurrency ?? 'AUD',
    collectedRevenue: 0,
    reservedObligations: input.snapshot.obligations.length,
    readyToRelease: input.snapshot.summary.releaseReadyCount,
    heldBack: Math.max(
      0,
      input.snapshot.summary.participantCount - input.snapshot.summary.releaseReadyCount
    ),
    heldBackReasons: explanation.blockers,
    blockedParticipantCount: input.snapshot.participants.filter(
      (p) => !p.readinessHierarchy.release.ready
    ).length,
    riskWarnings: [],
    releasableObligationCount: input.snapshot.obligations.filter((o) => o.operational.releaseReady)
      .length,
    totalObligationCount: input.snapshot.obligations.length,
    explainability: explanation.explainability,
  };

  const timeline: TimelineEvent[] = (input.auditTimeline ?? []).map((e) => ({
    id: e.id,
    type: 'state_transition',
    title: e.title,
    description: e.description,
    timestamp: e.timestamp,
    completed: true,
  }));

  return {
    explanation,
    stateExplanation: explainWorkspaceState(
      input.snapshot.summary.releaseReadyCount > 0 ? 'ACTIVE' : 'CONFIGURING',
      explanation.blockers
    ),
    actions: deduplicateOperationalActions(
      deriveNextOperationalActions(explanation, input.workspace)
    ),
    trustSignals: deriveTrustSignals({ workspace: input.workspace }),
    releaseConfidence,
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
  const scoped = snapshot.participants.filter((p) => dealIds.has(p.participant.id));
  return {
    releaseReadyCount: scoped.filter((p) => p.readinessHierarchy.release.ready).length,
    payoutReadyCount: scoped.filter((p) => p.payoutReadiness.payoutReady).length,
    participantCount: scoped.length,
  };
}

export function treasuryFundingLabelFromGraph(
  snapshot: OperationalCoordinationSnapshot
): { fundingLabel: string; fundingSubcopy: string } {
  const state = deriveCanonicalFundingLifecycle(snapshot.funding.stage);
  const blocker = fundingLifecycleBlocker(state);
  return {
    fundingLabel: fundingLifecycleLabel(state),
    fundingSubcopy: blocker ?? 'Funding coordination is on track.',
  };
}
