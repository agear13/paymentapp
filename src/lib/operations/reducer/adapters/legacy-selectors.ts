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
import { deriveAuditTimelineFromGraph } from '@/lib/operations/audit/derive-audit-timeline-from-state';
import { mergeAuditTimeline } from '@/lib/operations/audit/operational-audit';
import {
  fundingInputFromTreasury,
  hasPersistedOperationalEntities,
  type CommercialTreasuryData,
} from '@/lib/operations/selectors/build-persisted-coordination-snapshot';
import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability/types';

export type BuildCanonicalStateInput = ReduceOperationalStateInput & {
  auditTimeline?: OperationalAuditEntry[];
};

function seedFromSnapshot(
  snapshot: OperationalCoordinationSnapshot,
  activation: WorkspaceActivationInput,
  options?: {
    graphReady?: boolean;
    graphSnapshotConverged?: boolean;
    treasury?: CommercialTreasuryData | null;
  }
): ReduceOperationalStateInput['seed'] {
  const participants = snapshot.participants.map((row) => row.participant);
  const entityAuthoritative = hasPersistedOperationalEntities(participants);
  const funding =
    fundingInputFromTreasury(options?.treasury) ??
    (snapshot.funding.stage
      ? {
          fundingSourceConnected: Boolean(snapshot.funding.stage.fundingSourceConnected),
          confirmedFunding: snapshot.funding.allocated ? 1 : 0,
          obligationsTotal: snapshot.obligations.reduce((s, o) => s + (o.amount ?? 0), 0),
          obligationsFunded: snapshot.obligations.reduce((s, o) => s + (o.amountFunded ?? 0), 0),
        }
      : undefined);

  return {
    participants,
    obligations: snapshot.obligations.map((o) => ({
      id: o.id,
      amount: o.amount,
      amountFunded: o.amountFunded,
      currency: o.currency,
      participantId: o.participantId,
      allocationStatus: o.allocationStatus,
      readiness: o.readiness,
    })),
    funding,
    fundingAllocated:
      snapshot.funding.allocated ||
      Boolean(funding?.fundingSourceConnected && (funding.confirmedFunding ?? 0) > 0),
    projectId: activation.primaryProjectId ?? undefined,
    graphReady: entityAuthoritative ? true : options?.graphReady,
    graphSnapshotConverged: entityAuthoritative ? true : options?.graphSnapshotConverged,
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
    treasury?: CommercialTreasuryData | null;
  }
): CanonicalOperationalState {
  const seed = seedFromSnapshot(snapshot, input.activation, input);
  const workspace = workspaceContextFromActivationSeed(seed, input.activation);
  const persistedAudit = deriveAuditTimelineFromGraph(snapshot, input.activation.primaryProjectId ?? undefined);
  const auditTimeline = mergeAuditTimeline(persistedAudit, input.auditTimeline ?? []);
  const entityAuthoritative = hasPersistedOperationalEntities(seed.participants);

  return reduceOperationalState({
    events: collectOperationalEventStream({
      events: input.events,
      auditTimeline,
    }),
    seed: {
      ...seed,
      workspace,
      graphReady: entityAuthoritative ? true : (input.graphReady ?? true),
      graphSnapshotConverged: entityAuthoritative
        ? true
        : (input.graphSnapshotConverged ?? input.graphReady ?? true),
    },
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

/**
 * Build release confidence from canonical state.
 *
 * Parts 2 & 3 of the Commercial OS V4 audit:
 *
 * - collectedRevenue: Uses treasury.confirmedFunding when available — the only
 *   authoritative source of real money received. Falls back to 0 (never optimistic).
 *
 * - readyToRelease: When treasury data is available, computes a proportional dollar
 *   estimate (releasableObligations / totalObligations * confirmedFunding). Without
 *   treasury it falls back to releaseEligibleCount — a participant count proxy that
 *   is documented here as an approximation, not a currency amount. Components that
 *   need dollar precision must pass treasury.
 */
function buildReleaseConfidenceFromState(
  state: CanonicalOperationalState,
  blockers: ReturnType<typeof deriveCanonicalOperationalBlockers>,
  treasury?: CommercialTreasuryData | null
): ReleaseConfidenceSnapshot {
  const currency =
    treasury?.currency ?? state.coordination.workspace?.defaultCurrency ?? 'USD';

  // Money signals — only non-zero when real treasury data is present
  const collectedRevenue = treasury?.confirmedFunding ?? 0;

  const releasableCount = state.obligations.filter(
    (o) => o.obligation.operational.releaseReady
  ).length;
  const totalObligationCount = state.kpis.obligationCount;

  // Prefer proportional dollar estimate from treasury when we have both confirmed
  // funding and releasable obligation counts. Without treasury, fall back to the
  // participant-count proxy — documented as an approximation.
  const readyToRelease: number = (() => {
    if (collectedRevenue > 0 && totalObligationCount > 0) {
      // Dollar estimate: proportion of collected revenue that is releasable
      return Math.round((releasableCount / Math.max(1, totalObligationCount)) * collectedRevenue);
    }
    if (treasury?.obligationsReady !== undefined && treasury.obligationsReady > 0) {
      return treasury.obligationsReady; // obligation count (not dollars) — labelled as count
    }
    // Final fallback: participant count proxy. Not a dollar amount.
    // Only reliable for binary "is anything ready?" checks (> 0).
    return state.kpis.releaseEligibleCount;
  })();

  const heldBack = Math.max(0, collectedRevenue - readyToRelease);

  return {
    level: state.confidence.level,
    score: state.confidence.score,
    currency,
    collectedRevenue,
    reservedObligations: treasury?.obligationsTotal ?? state.kpis.obligationCount,
    readyToRelease,
    heldBack,
    heldBackReasons: blockers.map((b) => b.reason),
    blockedParticipantCount: state.participants.filter((p) => !p.releaseReadiness.releaseReady)
      .length,
    riskWarnings: [],
    releasableObligationCount: releasableCount,
    totalObligationCount,
    explainability: state.confidence.explainability,
  };
}

export function guidanceFromCanonicalState(
  state: CanonicalOperationalState,
  _scopeTitle = 'Workspace',
  /**
   * Treasury data from the Commercial Brain's upstream.
   * When provided, collectedRevenue and readyToRelease reflect real money.
   * When absent, collectedRevenue = 0 (conservative) and readyToRelease = releaseEligibleCount (count proxy).
   */
  treasury?: CommercialTreasuryData | null
): Pick<OperationalGuidanceBundle, 'releaseBlockers' | 'timeline' | 'releaseConfidence'> {
  const blockers = deriveCanonicalOperationalBlockers(state);
  return {
    releaseBlockers: blockers,
    timeline: state.timeline,
    releaseConfidence: buildReleaseConfidenceFromState(state, blockers, treasury),
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
