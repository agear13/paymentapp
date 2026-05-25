/**
 * Canonical participant release eligibility — single derivation for all payout surfaces.
 */

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { OperationalBlockerDetail } from '@/lib/operations/contracts/approval-state';
import type { CatalogItemRef } from '@/lib/operations/derivations/commission-scope';
import {
  derivePayoutReleaseReadiness,
  type PayoutReleaseContext,
} from '@/lib/operations/readiness/derive-payout-release-readiness';

export type ParticipantReleaseEligibility = {
  participantId: string;
  releaseReady: boolean;
  payoutReady: boolean;
  agreementApproved: boolean;
  operatorConfirmed: boolean;
  attributionEligible: boolean;
  blockers: string[];
  operationalBlockers: OperationalBlockerDetail[];
  primaryBlocker: OperationalBlockerDetail | null;
};

export type ParticipantReleaseEligibilityContext = PayoutReleaseContext & {
  obligationStatus?: string;
};

/** Used by participant tables, payout overview, release batches, obligations, workspace coordination. */
export function deriveParticipantReleaseEligibility(
  participant: DemoParticipant,
  context: ParticipantReleaseEligibilityContext = {}
): ParticipantReleaseEligibility {
  const readiness = derivePayoutReleaseReadiness(participant, context);
  return {
    participantId: readiness.participantId,
    releaseReady: readiness.releaseReady,
    payoutReady: readiness.releaseReady,
    agreementApproved: readiness.agreementApproved,
    operatorConfirmed: readiness.operatorConfirmed,
    attributionEligible: readiness.attributionEligible,
    blockers: readiness.blockers,
    operationalBlockers: readiness.operationalBlockers,
    primaryBlocker: readiness.primaryBlocker,
  };
}

export function deriveParticipantReleaseEligibilityBatch(
  participants: DemoParticipant[],
  context: Omit<ParticipantReleaseEligibilityContext, 'catalogItems'> & {
    catalogItemsByParticipant?: Record<string, CatalogItemRef[]>;
    obligationStatusByParticipant?: Record<string, string>;
  } = {}
): ParticipantReleaseEligibility[] {
  return participants.map((p) =>
    deriveParticipantReleaseEligibility(p, {
      ...context,
      catalogItems: context.catalogItemsByParticipant?.[p.id],
      obligationStatus: context.obligationStatusByParticipant?.[p.id],
    })
  );
}

export function countReleaseEligibleParticipants(
  participants: DemoParticipant[],
  context: Omit<ParticipantReleaseEligibilityContext, 'catalogItems'> & {
    catalogItemsByParticipant?: Record<string, CatalogItemRef[]>;
    obligationStatusByParticipant?: Record<string, string>;
  } = {}
): number {
  return deriveParticipantReleaseEligibilityBatch(participants, context).filter((r) => r.releaseReady)
    .length;
}
