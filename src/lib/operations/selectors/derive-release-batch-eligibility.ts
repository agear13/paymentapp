import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import { deriveParticipantReleaseEligibility } from '@/lib/operations/readiness/derive-participant-release-eligibility';

export type ReleaseBatchEligibleParticipant = {
  participantId: string;
  participantName: string;
  amount: number;
  obligationCount: number;
  currency: string;
  blockers: string[];
  releaseReady: boolean;
};

export type ReleaseBatchEligibility = {
  eligibleParticipants: ReleaseBatchEligibleParticipant[];
  lineCount: number;
  participantCount: number;
  total: number;
  currency: string;
};

type ReleaseBatchEligibilityInput = {
  currency: string;
  minThreshold?: number;
};

function mapOperationalReadinessToObligationStatus(
  readiness?: string
): string | undefined {
  if (!readiness) return undefined;
  if (readiness === 'ready') return 'AVAILABLE_FOR_PAYOUT';
  if (readiness === 'awaiting_funding') return 'UNFUNDED';
  if (readiness === 'partially_funded') return 'PARTIALLY_FUNDED';
  return readiness;
}

/**
 * Canonical release batch eligibility — sole source for preview and batch creation.
 * Derives exclusively from operational coordination graph + release eligibility selector.
 */
export function deriveReleaseBatchEligibility(
  snapshot: OperationalCoordinationSnapshot,
  input: ReleaseBatchEligibilityInput
): ReleaseBatchEligibility {
  const currency = input.currency.toUpperCase();
  const minThreshold = input.minThreshold ?? 0;

  const eligibleParticipants: ReleaseBatchEligibleParticipant[] = [];

  for (const row of snapshot.participants) {
    const participant = row.participant;
    const participantObligations = snapshot.obligations.filter(
      (o) => o.participantId === participant.id && o.currency.toUpperCase() === currency
    );

    const eligibility = deriveParticipantReleaseEligibility(participant, {
      fundingAllocated: snapshot.funding.allocated,
      obligationStatus: mapOperationalReadinessToObligationStatus(participantObligations[0]?.readiness),
      projectCurrency: snapshot.projectCurrency,
      serviceCurrencies: snapshot.serviceCurrencies,
    });

    const releaseEligible = eligibility.releaseReady;
    if (!releaseEligible) continue;

    const amount = participantObligations.reduce((sum, o) => sum + o.amount, 0);
    if (amount < minThreshold) continue;

    eligibleParticipants.push({
      participantId: participant.id,
      participantName: participant.name,
      amount,
      obligationCount: participantObligations.length,
      currency,
      blockers: eligibility.blockers,
      releaseReady: true,
    });
  }

  const lineCount = eligibleParticipants.reduce((n, p) => n + p.obligationCount, 0);
  const total = eligibleParticipants.reduce((sum, p) => sum + p.amount, 0);

  return {
    eligibleParticipants,
    lineCount,
    participantCount: eligibleParticipants.length,
    total,
    currency,
  };
}
