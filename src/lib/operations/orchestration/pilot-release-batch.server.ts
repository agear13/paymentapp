import 'server-only';

import { DealNetworkPilotObligationStatus } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { resolveOperationalCoordinationSnapshot } from '@/lib/operations/selectors/resolve-operational-coordination.server';
import { deriveReleaseBatchEligibility } from '@/lib/operations/selectors/derive-release-batch-eligibility';
import { assertBatchInvariants } from '@/lib/operations/dev/operational-invariants';

export type PilotReleaseBatchInput = {
  userId: string;
  organizationId: string;
  projectId?: string;
  currency: string;
  minThreshold?: number;
};

export type PilotReleaseBatchLine = {
  obligationId: string;
  participantId: string;
  participantName: string;
  amount: number;
  currency: string;
};

/** Canonical pilot obligation → release batch lines — same graph as eligibility preview. */
export async function derivePilotReleaseBatchLines(
  input: PilotReleaseBatchInput
): Promise<PilotReleaseBatchLine[]> {
  const graph = await resolveOperationalCoordinationSnapshot({
    userId: input.userId,
    projectId: input.projectId,
  });

  const eligibility = deriveReleaseBatchEligibility(graph, {
    currency: input.currency,
    minThreshold: input.minThreshold ?? 0,
  });

  const lines: PilotReleaseBatchLine[] = [];

  for (const eligible of eligibility.eligibleParticipants) {
    const obligations = await prisma.deal_network_pilot_obligations.findMany({
      where: {
        user_id: input.userId,
        participant_id: eligible.participantId,
        status: DealNetworkPilotObligationStatus.AVAILABLE_FOR_PAYOUT,
        currency: input.currency.toUpperCase(),
      },
      select: { id: true, amount_owed: true, currency: true, participant_id: true },
    });

    for (const obl of obligations) {
      lines.push({
        obligationId: obl.id,
        participantId: obl.participant_id ?? eligible.participantId,
        participantName: eligible.participantName,
        amount: Number(obl.amount_owed) || 0,
        currency: obl.currency ?? input.currency,
      });
    }
  }

  assertBatchInvariants({
    batchCreated: false,
    eligibleParticipantCount: eligibility.participantCount,
    includedParticipantCount: eligibility.participantCount,
  });

  return lines;
}

/** Returns pilot lines when graph-eligible; empty when ledger path should be used. */
export async function pilotReleaseBatchPreferred(
  input: PilotReleaseBatchInput
): Promise<{ usePilot: boolean; lines: PilotReleaseBatchLine[]; eligibleCount: number }> {
  const graph = await resolveOperationalCoordinationSnapshot({
    userId: input.userId,
    projectId: input.projectId,
  });
  const eligibility = deriveReleaseBatchEligibility(graph, {
    currency: input.currency,
    minThreshold: input.minThreshold ?? 0,
  });

  if (eligibility.participantCount === 0) {
    return { usePilot: false, lines: [], eligibleCount: 0 };
  }

  const lines = await derivePilotReleaseBatchLines(input);
  return {
    usePilot: lines.length > 0,
    lines,
    eligibleCount: eligibility.participantCount,
  };
}
