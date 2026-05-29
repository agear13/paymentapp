/**
 * Centralized operational coordination snapshot — authoritative truth for all surfaces.
 */

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { OperationalBlockerDetail } from '@/lib/operations/contracts/approval-state';
import {
  deriveAgreementApprovalState,
  deriveOperationalBlocker,
} from '@/lib/operations/derivations/derive-approval-state';
import type { CatalogItemRef } from '@/lib/operations/derivations/commission-scope';
import { deriveObligationState, type RawObligationInput } from '@/lib/operations/derivations/derive-obligation-state';
import { countReleaseEligibleParticipants } from '@/lib/operations/readiness/derive-participant-release-eligibility';
import { derivePayoutReleaseReadiness } from '@/lib/operations/readiness/derive-payout-release-readiness';
import { deriveParticipantPayoutReadiness } from '@/lib/operations/readiness/participant-readiness';
import { hydrateOperationalParticipants } from '@/lib/operations/hydration/hydrate-operational-participant';
import { assertOperationalInvariants } from '@/lib/operations/dev/operational-invariants';
import {
  classifyParticipantCompensation,
  compensationGeneratesObligations,
} from '@/lib/operations/contracts/compensation-classification';
import {
  hasPersistedCompensationTerms,
  hasPersistedPayoutReadyForKpi,
} from '@/lib/operations/primitives/participant-earnings-primitives';
import { warnOperationalInconsistency } from '@/lib/operations/dev/operational-diagnostics';
import { deriveOperationalReadinessHierarchy } from '@/lib/operations/readiness/readiness-hierarchy';
import {
  deriveFundingCoordinationStage,
  type FundingCoordinationInput,
} from '@/lib/operations/truth/funding-coordination-semantics';

export type OperationalCoordinationSnapshot = {
  participants: Array<{
    participant: DemoParticipant;
    agreementApproval: ReturnType<typeof deriveAgreementApprovalState>;
    payoutReadiness: ReturnType<typeof deriveParticipantPayoutReadiness>;
    releaseReadiness: ReturnType<typeof derivePayoutReleaseReadiness>;
    readinessHierarchy: ReturnType<typeof deriveOperationalReadinessHierarchy>;
    blockers: OperationalBlockerDetail[];
  }>;
  obligations: ReturnType<typeof deriveObligationState>[];
  summary: {
    participantCount: number;
    earningsConfiguredCount: number;
    payoutReadyCount: number;
    releaseReadyCount: number;
    blockerCount: number;
    allBlockers: OperationalBlockerDetail[];
  };
  funding: {
    allocated: boolean;
    stage: ReturnType<typeof deriveFundingCoordinationStage> | null;
  };
  projectCurrency?: string;
  serviceCurrencies?: string[];
};

export type OperationalCoordinationInput = {
  participants: DemoParticipant[];
  obligations?: RawObligationInput[];
  projectId?: string;
  fundingAllocated?: boolean;
  funding?: FundingCoordinationInput;
  obligationStatusByParticipant?: Record<string, string>;
  catalogItemsByParticipant?: Record<string, CatalogItemRef[]>;
  projectCurrency?: string;
  serviceCurrencies?: string[];
};

/** Authoritative coordination truth — future screens must consume this selector. */
export function getOperationalCoordinationSnapshot(
  input: OperationalCoordinationInput
): OperationalCoordinationSnapshot {
  const participants = hydrateOperationalParticipants(input.participants);
  const obligations = (input.obligations ?? []).map((o) => deriveObligationState(o));

  const fundingStage = input.funding
    ? deriveFundingCoordinationStage(input.funding)
    : null;
  const effectiveFundingAllocated = Boolean(
    fundingStage?.releaseFunded ||
      fundingStage?.fundingReserved ||
      input.fundingAllocated
  );

  const participantSnapshots = participants.map((participant) => {
    const catalogItems = input.catalogItemsByParticipant?.[participant.id];
    const participantObligations = obligations.filter(
      (o) => o.participantId === participant.id
    );
    const allocationStatus =
      input.obligationStatusByParticipant?.[participant.id] ??
      participantObligations[0]?.allocationStatus;
    const agreementApproval = deriveAgreementApprovalState(participant);
    const payoutReadiness = deriveParticipantPayoutReadiness(participant);
    const releaseReadiness = derivePayoutReleaseReadiness(participant, {
      projectId: input.projectId,
      fundingAllocated: effectiveFundingAllocated,
      obligationStatus: allocationStatus,
      catalogItems,
      projectCurrency: input.projectCurrency,
      serviceCurrencies: input.serviceCurrencies,
    });
    const readinessHierarchy = deriveOperationalReadinessHierarchy({
      participant,
      projectId: input.projectId,
      funding: input.funding,
      obligationCount: participantObligations.length,
      obligationStatus: allocationStatus,
      catalogItems,
      projectCurrency: input.projectCurrency,
      serviceCurrencies: input.serviceCurrencies,
    });
    const blockers = [
      ...deriveOperationalBlocker(participant, input.projectId),
      ...readinessHierarchy.currencyBlockers,
    ];

    warnOperationalInconsistency({
      participant,
      agreementApproval,
      payoutReadiness,
      releaseReadiness,
      catalogItems,
    });

    const compensationClass = classifyParticipantCompensation(participant);
    const compensationConfigured =
      compensationGeneratesObligations(compensationClass) &&
      hasPersistedCompensationTerms(participant);

    assertOperationalInvariants({
      participantId: participant.id,
      payoutReady: payoutReadiness.payoutReady,
      releaseReady: readinessHierarchy.releaseReady,
      obligationCount: participantObligations.length,
      obligationsFunded: participantObligations.some(
        (o) => o.operational.releaseReady || o.readiness === 'ready'
      ),
      compensationConfigured,
      attributionEnabled: participant.compensationProfile?.customerAttributionEnabled === true,
      referralLinkPresent: Boolean(
        participant.inviteLink || participant.customerCommerceUrl || participant.referralCode
      ),
      agreementApproved:
        agreementApproval === 'participant_approved' || agreementApproval === 'fully_approved',
      syncCompleted: true,
      currencyConsistent: readinessHierarchy.currencyBlockers.length === 0,
    });

    return {
      participant,
      agreementApproval,
      payoutReadiness,
      releaseReadiness,
      readinessHierarchy,
      blockers,
    };
  });

  const releaseReadyCount = countReleaseEligibleParticipants(participants, {
    projectId: input.projectId,
    fundingAllocated: effectiveFundingAllocated,
    catalogItemsByParticipant: input.catalogItemsByParticipant,
    obligationStatusByParticipant: input.obligationStatusByParticipant,
    projectCurrency: input.projectCurrency,
    serviceCurrencies: input.serviceCurrencies,
  });

  const allBlockers = participantSnapshots.flatMap((s) => s.blockers);

  return {
    participants: participantSnapshots,
    obligations,
    summary: {
      participantCount: participants.length,
      earningsConfiguredCount: participantSnapshots.filter((s) =>
        hasPersistedCompensationTerms(s.participant)
      ).length,
      payoutReadyCount: participantSnapshots.filter((s) =>
        hasPersistedPayoutReadyForKpi(s.participant)
      ).length,
      releaseReadyCount,
      blockerCount: allBlockers.length,
      allBlockers,
    },
    funding: {
      allocated: effectiveFundingAllocated,
      stage: fundingStage,
    },
    projectCurrency: input.projectCurrency,
    serviceCurrencies: input.serviceCurrencies,
  };
}

/** Deterministic degraded summary — safe for pre-OPERATIONAL_GRAPH_READY projection boundaries. */
export function emptyOperationalGraphSummary(): OperationalCoordinationSnapshot['summary'] {
  return {
    participantCount: 0,
    earningsConfiguredCount: 0,
    payoutReadyCount: 0,
    releaseReadyCount: 0,
    blockerCount: 0,
    allBlockers: [],
  };
}

export function emptyOperationalGraphFunding(): OperationalCoordinationSnapshot['funding'] {
  return { allocated: false, stage: null };
}

export type CoordinationSnapshotProjectionPayload = {
  graphReady?: boolean;
  summary: OperationalCoordinationSnapshot['summary'] | null;
  funding: OperationalCoordinationSnapshot['funding'] | null;
  participants?: OperationalCoordinationSnapshot['participants'];
};

/** Returns null only when no persisted operational entities are present in the payload. */
export function parseCoordinationSnapshotProjection(
  payload: CoordinationSnapshotProjectionPayload
): Pick<OperationalCoordinationSnapshot, 'summary' | 'funding' | 'participants' | 'obligations'> | null {
  if (payload.summary == null || payload.funding == null) return null;
  const hasEntities =
    (payload.summary.participantCount ?? 0) > 0 ||
    (payload.participants?.length ?? 0) > 0;
  if (payload.graphReady === false && !hasEntities) return null;
  return {
    summary: payload.summary,
    funding: payload.funding,
    participants: payload.participants ?? [],
    obligations: [],
  };
}
