import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import type { WorkspaceActivationInput } from '@/lib/onboarding/workspace-activation-state';
import type { WorkspaceActivationSnapshot } from '@/lib/onboarding/workspace-activation-types';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type { OperationalGuidanceBundle } from '@/lib/operations/explainability/types';
import {
  deriveCanonicalOperationalBlockers,
} from '@/lib/operations/reducer/derive-canonical-operational-blockers';
import { deriveOperationalKPIs } from '@/lib/operations/reducer/derive-operational-kpis';
import { deriveAttributionServiceScopeFromState } from '@/lib/operations/reducer/derive-attribution-service-scope-from-state';
import { deriveOperationalObligationsFromState } from '@/lib/operations/reducer/derive-operational-obligations-from-state';
import type { ReduceOperationalStateInput } from '@/lib/operations/reducer/types';
import { reduceOperationalState } from '@/lib/operations/reducer/reduce-operational-state';
import type { CanonicalOperationalState } from '@/lib/operations/reducer/types';
import type { OperationalEvent } from '@/lib/operations/contracts/operational-events';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import { collectOperationalEventStream } from '@/lib/operations/timeline/canonical-operational-event';

export type BuildCanonicalStateInput = ReduceOperationalStateInput & {
  auditTimeline?: OperationalAuditEntry[];
};

function seedFromSnapshot(
  snapshot: OperationalCoordinationSnapshot,
  activation: WorkspaceActivationInput,
  options?: { graphReady?: boolean; graphSnapshotConverged?: boolean }
): ReduceOperationalStateInput['seed'] {
  return {
    participants: snapshot.participants.map((row) => row.participant),
    obligations: snapshot.obligations.map((o) => ({
      id: o.id,
      amount: o.amount,
      amountFunded: o.amountFunded,
      currency: o.currency,
      participantId: o.participantId,
      allocationStatus: o.allocationStatus,
      readiness: o.readiness,
    })),
    fundingAllocated: snapshot.funding.allocated,
    projectId: activation.primaryProjectId ?? undefined,
    graphReady: options?.graphReady,
    graphSnapshotConverged: options?.graphSnapshotConverged,
    releaseBatchCount: activation.releaseBatchCount,
  };
}

/** Build canonical state from snapshot + activation — adapter entry for legacy callers. */
export function buildCanonicalStateFromSnapshot(
  snapshot: OperationalCoordinationSnapshot,
  input: {
    activation: WorkspaceActivationInput;
    events?: OperationalEvent[];
    auditTimeline?: OperationalAuditEntry[];
    graphReady?: boolean;
    graphSnapshotConverged?: boolean;
  }
): CanonicalOperationalState {
  const seed = seedFromSnapshot(snapshot, input.activation, input);
  const workspace = workspaceContextFromActivationSeed(seed, input.activation);

  return reduceOperationalState({
    events: collectOperationalEventStream({
      events: input.events,
      auditTimeline: input.auditTimeline,
    }),
    seed: { ...seed, workspace },
  });
}

function workspaceContextFromActivationSeed(
  seed: ReduceOperationalStateInput['seed'],
  activation: WorkspaceActivationInput
): WorkspaceOperationalContext {
  return {
    hasOrganization: activation.hasOrganization,
    onboardingCompleted: activation.onboardingCompleted,
    defaultCurrency: activation.defaultCurrency,
    stripeConfigured: activation.stripeConfigured,
    wiseConfigured: activation.wiseConfigured,
    hederaConfigured: activation.hederaConfigured,
    projectCount: activation.projectCreated ? 1 : 0,
    primaryProjectId: activation.primaryProjectId ?? null,
    participantCount: activation.participantCount,
    participantsConfiguredCount: activation.participantsConfiguredCount,
    obligationCount: seed.obligations?.length ?? 0,
    paymentLinkCount: activation.paymentLinkCount,
    collectionPreferenceDecideLater: activation.collectionPreferenceDecideLater,
    releaseEligibleCount: 0,
    releaseBatchCount: activation.releaseBatchCount,
  };
}

export function workspaceContextFromCanonicalState(
  state: CanonicalOperationalState,
  activation?: WorkspaceActivationInput
): WorkspaceOperationalContext {
  const kpis = deriveOperationalKPIs(state);
  if (!activation) {
    const base = state.coordination.workspace;
    return {
      hasOrganization: base?.hasOrganization ?? false,
      onboardingCompleted: base?.onboardingCompleted ?? false,
      defaultCurrency: base?.defaultCurrency ?? 'USD',
      stripeConfigured: base?.stripeConfigured ?? false,
      wiseConfigured: base?.wiseConfigured ?? false,
      hederaConfigured: base?.hederaConfigured ?? false,
      projectCount: base?.projectCount ?? 0,
      primaryProjectId: base?.primaryProjectId != null ? base.primaryProjectId : null,
      participantCount: Math.max(base?.participantCount ?? 0, kpis.participantCount),
      participantsConfiguredCount: kpis.earningsConfiguredCount,
      obligationCount: kpis.obligationCount,
      paymentLinkCount: base?.paymentLinkCount ?? 0,
      collectionPreferenceDecideLater: base?.collectionPreferenceDecideLater ?? false,
      releaseEligibleCount: kpis.releaseEligibleCount,
      releaseBatchCount: base?.releaseBatchCount ?? 0,
    };
  }

  return {
    hasOrganization: activation.hasOrganization,
    onboardingCompleted: activation.onboardingCompleted,
    defaultCurrency: activation.defaultCurrency,
    stripeConfigured: activation.stripeConfigured,
    wiseConfigured: activation.wiseConfigured,
    hederaConfigured: activation.hederaConfigured,
    projectCount: activation.projectCreated ? 1 : 0,
    primaryProjectId: activation.primaryProjectId ?? null,
    participantCount: Math.max(activation.participantCount, kpis.participantCount),
    participantsConfiguredCount: kpis.earningsConfiguredCount,
    obligationCount: kpis.obligationCount,
    paymentLinkCount: activation.paymentLinkCount,
    collectionPreferenceDecideLater: activation.collectionPreferenceDecideLater,
    releaseEligibleCount: kpis.releaseEligibleCount,
    releaseBatchCount: activation.releaseBatchCount,
  };
}

export function activationFromCanonicalState(
  state: CanonicalOperationalState,
  activation: WorkspaceActivationInput
): WorkspaceActivationSnapshot {
  const kpis = deriveOperationalKPIs(state);
  const provider =
    activation.stripeConfigured || activation.wiseConfigured || activation.hederaConfigured;
  const revenue =
    provider ||
    activation.paymentLinkCount > 0 ||
    !activation.collectionPreferenceDecideLater;

  const progress =
    kpis.participantCount === 0
      ? 10
      : Math.min(
          100,
          Math.round(
            (kpis.payoutReadyCount / Math.max(1, kpis.participantCount)) * 50 +
              (kpis.releaseEligibleCount > 0 ? 50 : kpis.obligationCount > 0 ? 25 : 0)
          )
        );

  const phase =
    state.release.phase === 'RELEASABLE' || state.release.phase === 'RELEASED'
      ? ('ready_for_release' as const)
      : state.blockers.length > 0
        ? ('ready_to_coordinate' as const)
        : ('setup_in_progress' as const);

  return {
    workspaceCreated: activation.hasOrganization,
    projectCreated: activation.projectCreated,
    participantCount: Math.max(activation.participantCount, kpis.participantCount),
    participantsConfigured: kpis.participantsConfigured,
    participantsConfiguredCount: kpis.earningsConfiguredCount,
    obligationsCreated: kpis.obligationCount > 0,
    obligationCount: kpis.obligationCount,
    revenueConfigured: revenue,
    providerConnected: provider,
    payoutMethodConfigured: provider,
    releaseEligible: kpis.releaseEligibleCount > 0,
    releaseEligibleCount: kpis.releaseEligibleCount,
    firstReleaseCompleted: (activation.releaseBatchCount ?? 0) > 0,
    onboardingCompleted: activation.onboardingCompleted,
    defaultCurrency: activation.defaultCurrency,
    onboardingProgressPercent: progress,
    phase,
    phaseLabel: state.readiness.releasePhase,
    checklist: [],
    activationBlockers: state.blockers.map((b) => b.reason),
    setupWarnings: [],
    primaryProjectId: activation.primaryProjectId ?? null,
    needsGuidance: state.blockers.length > 0 || kpis.releaseEligibleCount === 0,
    degraded: false,
  };
}

export function guidanceFromCanonicalState(
  state: CanonicalOperationalState,
  _scopeTitle = 'Workspace'
): Pick<OperationalGuidanceBundle, 'releaseBlockers' | 'timeline' | 'releaseConfidence'> {
  const blockers = deriveCanonicalOperationalBlockers(state);
  return {
    releaseBlockers: blockers,
    timeline: state.timeline,
    releaseConfidence: {
      level: state.confidence.level,
      score: state.confidence.score,
      currency: state.coordination.workspace?.defaultCurrency ?? 'USD',
      collectedRevenue: 0,
      reservedObligations: state.kpis.obligationCount,
      readyToRelease: state.kpis.releaseEligibleCount,
      heldBack: Math.max(0, state.kpis.participantCount - state.kpis.releaseEligibleCount),
      heldBackReasons: blockers.map((b) => b.reason),
      blockedParticipantCount: state.participants.filter((p) => !p.releaseReadiness.releaseReady)
        .length,
      riskWarnings: [],
      releasableObligationCount: state.obligations.filter(
        (o) => o.obligation.operational.releaseReady
      ).length,
      totalObligationCount: state.kpis.obligationCount,
      explainability: state.confidence.explainability,
    },
  };
}

export function participantPayoutReadinessFromState(
  state: CanonicalOperationalState,
  participantId: string
) {
  return state.participants.find((p) => p.participantId === participantId)?.payoutReadiness ?? null;
}

export function obligationsFromCanonicalState(state: CanonicalOperationalState) {
  return state.obligations;
}

export function attributionScopeFromCanonicalState(
  state: CanonicalOperationalState,
  participantId: string,
  catalogItems = state.attribution.find((a) => a.participantId === participantId)?.eligibleServices ?? []
) {
  return deriveAttributionServiceScopeFromState(state, participantId, catalogItems);
}

export { deriveOperationalObligationsFromState };
