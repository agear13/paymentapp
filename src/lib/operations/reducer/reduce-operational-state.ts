import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { deriveAgreementApprovalState } from '@/lib/operations/derivations/derive-approval-state';
import { deriveFundingCoordinationStage } from '@/lib/operations/truth/funding-coordination-semantics';
import { hydrateOperationalParticipants } from '@/lib/operations/hydration/hydrate-operational-participant';
import {
  isParticipantAttributionActive,
  isParticipantEarningsConfigured,
} from '@/lib/operations/selectors/participant-earnings-selectors';
import { deriveParticipantPayoutReadiness } from '@/lib/operations/readiness/participant-readiness';
import {
  derivePayoutReleaseReadiness,
  type PayoutReleaseContext,
} from '@/lib/operations/readiness/derive-payout-release-readiness';
import { collectOperationalEventStream } from '@/lib/operations/timeline/canonical-operational-event';
import { operationalTimelineReplayFingerprint } from '@/lib/operations/timeline/canonical-operational-event';
import { replayOperationalEvents } from '@/lib/operations/timeline/replay-operational-events';
import {
  deriveOnboardingMilestoneProjections,
  reduceOperationalTimelineEvents,
} from '@/lib/operations/timeline/derive-onboarding-milestone-projections';
import { deriveOperationalConfidenceFromEvents } from '@/lib/operations/timeline/derive-operational-confidence';
import { deriveBlockersFromEvents } from '@/lib/operations/timeline/derive-blockers-from-events';
import { deriveTimelineEventsFromProjection } from '@/lib/operations/timeline/derive-timeline-events';
import { deriveCanonicalOperationalBlockers } from '@/lib/operations/reducer/derive-canonical-operational-blockers';
import { deriveAllAttributionScopesFromState } from '@/lib/operations/reducer/derive-attribution-service-scope-from-state';
import { deriveOperationalObligationsFromState } from '@/lib/operations/reducer/derive-operational-obligations-from-state';
import {
  deriveOperationalKPIsFromParticipants,
} from '@/lib/operations/reducer/derive-operational-kpis';
import type {
  CanonicalFundingRecord,
  CanonicalOperationalState,
  CanonicalParticipantRecord,
  CanonicalReleasePhase,
  ReduceOperationalStateInput,
} from '@/lib/operations/reducer/types';
import { CANONICAL_EVENT_ALIASES as EVENT_ALIASES } from '@/lib/operations/reducer/types';
import type { OperationalEvent } from '@/lib/operations/contracts/operational-events';
import { defaultWorkspaceContext } from '@/lib/operations/types/operational-context';
import { assertCanonicalConvergenceInvariants } from '@/lib/operations/dev/operational-invariants';

function normalizeIncomingEvents(events: OperationalEvent[]): OperationalEvent[] {
  return events.map((event) => {
    const alias = EVENT_ALIASES[event.type as keyof typeof EVENT_ALIASES];
    if (!alias) return event;
    return { ...event, type: alias };
  });
}

/** Release phase from persisted entities only — not from event stream or graph convergence flags. */
function deriveReleasePhase(input: {
  releaseEligibleCount: number;
  releaseBatchCount: number;
  payoutReadyCount: number;
  participantCount: number;
  obligationCount: number;
}): CanonicalReleasePhase {
  if (input.releaseBatchCount > 0) return 'RELEASED';
  if (input.releaseEligibleCount > 0) return 'RELEASABLE';
  if (
    input.payoutReadyCount > 0 ||
    input.obligationCount > 0 ||
    input.participantCount > 0
  ) {
    return 'READY';
  }
  return 'INITIALIZING';
}

function buildFundingRecord(
  seed: ReduceOperationalStateInput['seed']
): CanonicalFundingRecord {
  const stage = seed.funding ? deriveFundingCoordinationStage(seed.funding) : null;
  const allocated = Boolean(
    stage?.releaseFunded || stage?.fundingReserved || seed.fundingAllocated
  );
  return {
    allocated,
    reconciled: Boolean(stage?.releaseFunded || stage?.fundingReserved),
    stageLabel: stage?.primaryLabel ?? null,
    blockerLabel: stage?.blockerLabel ?? null,
  };
}

function buildParticipantRecords(
  participants: DemoParticipant[],
  seed: ReduceOperationalStateInput['seed'],
  obligationsByParticipant: Map<string, string | undefined>
): CanonicalParticipantRecord[] {
  const hydrated = hydrateOperationalParticipants(participants);

  return hydrated.map((entity) => {
    const payoutReadiness = deriveParticipantPayoutReadiness(entity, {
      obligationsLinked: obligationsByParticipant.has(entity.id),
    });
    const releaseContext: PayoutReleaseContext = {
      projectId: seed.projectId,
      fundingAllocated: buildFundingRecord(seed).allocated,
      obligationStatus: obligationsByParticipant.get(entity.id),
      catalogItems: seed.catalogItemsByParticipant?.[entity.id],
      projectCurrency: seed.projectCurrency,
      serviceCurrencies: seed.serviceCurrencies,
    };
    const releaseReadiness = derivePayoutReleaseReadiness(entity, releaseContext);
    const agreementState = deriveAgreementApprovalState(entity);
    const agreementApproved =
      agreementState === 'participant_approved' || agreementState === 'fully_approved';

    return {
      participantId: entity.id,
      entity,
      payoutReadiness,
      releaseReadiness,
      compensationConfigured: isParticipantEarningsConfigured(entity),
      agreementApproved,
      payoutConfirmed:
        entity.compensationProfile?.exemptFromPayout === true ||
        entity.payoutVerificationConfirmed === true,
      attributionActive: isParticipantAttributionActive(entity, {
        catalogItems: seed.catalogItemsByParticipant?.[entity.id] ?? seed.catalogItems,
      }),
    };
  });
}

/**
 * Single canonical operational reducer — all readiness, obligations, release,
 * KPI, blocker, and timeline projections derive from this output.
 */
export function reduceOperationalState(
  input: ReduceOperationalStateInput
): CanonicalOperationalState {
  const hasPersistedParticipants = (input.seed.participants?.length ?? 0) > 0;
  const graphReady = hasPersistedParticipants
    ? true
    : (input.seed.graphReady ?? true);
  const graphConverged = hasPersistedParticipants
    ? true
    : (input.seed.graphSnapshotConverged ?? graphReady);
  const workspace = input.seed.workspace ?? defaultWorkspaceContext();

  const normalizedEvents = normalizeIncomingEvents(
    collectOperationalEventStream({ events: input.events ?? [] })
  );
  const canonicalEvents = replayOperationalEvents(normalizedEvents);
  const timelineReducer = reduceOperationalTimelineEvents(canonicalEvents);
  const milestones = deriveOnboardingMilestoneProjections(timelineReducer);
  const confidence = deriveOperationalConfidenceFromEvents({
    state: timelineReducer,
    events: canonicalEvents,
    workspace,
    graphSnapshotConverged: graphConverged,
  });
  const eventBlockers = deriveBlockersFromEvents({
    state: timelineReducer,
    workspace,
    graphSnapshotConverged: graphConverged,
  });
  const timeline = deriveTimelineEventsFromProjection({ events: canonicalEvents, milestones });

  const funding = buildFundingRecord(input.seed);
  const persistedObligations = input.seed.obligations ?? [];
  const obligationStatusByParticipant = new Map<string, string | undefined>();
  for (const o of persistedObligations) {
    if (o.participantId) {
      obligationStatusByParticipant.set(o.participantId, o.allocationStatus);
    }
  }

  const participants = buildParticipantRecords(
    input.seed.participants,
    input.seed,
    obligationStatusByParticipant
  );

  let obligations = deriveOperationalObligationsFromState({
    participants,
    persistedObligations,
    funding,
    projectId: seedProjectId(input.seed),
  });

  const releaseEligibleCount = participants.filter((p) => p.releaseReadiness.releaseReady).length;
  let kpis = deriveOperationalKPIsFromParticipants(participants, obligations, releaseEligibleCount);

  const releasePhase = deriveReleasePhase({
    releaseEligibleCount,
    releaseBatchCount: input.seed.releaseBatchCount ?? workspace.releaseBatchCount ?? 0,
    payoutReadyCount: kpis.payoutReadyCount,
    participantCount: kpis.participantCount,
    obligationCount: kpis.obligationCount,
  });

  const attribution = deriveAllAttributionScopesFromState(
    {
      participants,
      agreements: participants.map((p) => ({
        participantId: p.participantId,
        approved: p.agreementApproved,
        shared: Boolean(p.entity.agreementSharedAt || p.entity.agreementUrl),
        approvedAt: p.entity.approvedAt ?? null,
      })),
      attribution: [],
      funding,
      obligations,
      release: {
        phase: releasePhase,
        releaseEligibleCount,
        releaseBatchCount: input.seed.releaseBatchCount ?? workspace.releaseBatchCount ?? 0,
      },
      readiness: {
        releasePhase,
        graphReady,
        graphConverged,
        settlementReady: releaseEligibleCount > 0 && !funding.blockerLabel,
        coordinationBlocked: false,
      },
      blockers: [],
      kpis,
      timeline,
      milestones,
      coordination: { graphReady, graphSnapshotConverged: graphConverged, workspace },
      confidence,
      events: canonicalEvents,
      replayFingerprint: operationalTimelineReplayFingerprint(canonicalEvents),
    },
    input.seed.catalogItemsByParticipant ?? {}
  );

  const partialState: CanonicalOperationalState = {
    participants,
    agreements: participants.map((p) => ({
      participantId: p.participantId,
      approved: p.agreementApproved,
      shared: Boolean(p.entity.agreementSharedAt || p.entity.agreementUrl),
      approvedAt: p.entity.approvedAt ?? null,
    })),
    attribution,
    funding,
    obligations,
    release: {
      phase: releasePhase,
      releaseEligibleCount,
      releaseBatchCount: input.seed.releaseBatchCount ?? workspace.releaseBatchCount ?? 0,
    },
    readiness: {
      releasePhase,
      graphReady,
      graphConverged,
      settlementReady: releaseEligibleCount > 0 && !funding.blockerLabel,
      coordinationBlocked: false,
    },
    blockers: [],
    kpis,
    timeline,
    milestones,
    coordination: { graphReady, graphSnapshotConverged: graphConverged, workspace },
    confidence,
    events: canonicalEvents,
    replayFingerprint: operationalTimelineReplayFingerprint(canonicalEvents),
  };

  const blockers = deriveCanonicalOperationalBlockers(partialState);
  partialState.blockers = blockers;

  assertCanonicalConvergenceInvariants({
    state: partialState,
    pageDerivedKpisIndependently: false,
    pageDerivedBlockersIndependently: false,
  });

  return partialState;
}

function seedProjectId(seed: ReduceOperationalStateInput['seed']): string | undefined {
  return seed.projectId ?? seed.workspace?.primaryProjectId ?? undefined;
}
