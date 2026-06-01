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

export type CreatePilotReleaseBatchResult = {
  batchId: string;
  currency: string;
  status: string;
  payoutCount: number;
  totalAmount: number;
};

/** Create payout batch from pilot obligation lines (Projects E2E path). */
export async function createPilotReleaseBatch(input: {
  organizationId: string;
  createdBy: string;
  currency: string;
  minThreshold: number;
  lines: PilotReleaseBatchLine[];
}): Promise<CreatePilotReleaseBatchResult | null> {
  const currencyUpper = input.currency.toUpperCase();
  const grouped = new Map<
    string,
    { amount: number; lines: PilotReleaseBatchLine[]; name: string }
  >();

  for (const line of input.lines) {
    const key = line.participantId;
    const existing = grouped.get(key);
    if (existing) {
      existing.amount += line.amount;
      existing.lines.push(line);
    } else {
      grouped.set(key, {
        amount: line.amount,
        lines: [line],
        name: line.participantName,
      });
    }
  }

  const payees = Array.from(grouped.entries()).filter(([, g]) => g.amount >= input.minThreshold);
  if (payees.length === 0) return null;

  const totalAmount = payees.reduce((sum, [, g]) => sum + g.amount, 0);

  const [batch] = await prisma.$transaction(async (tx) => {
    const batch = await tx.payout_batches.create({
      data: {
        organization_id: input.organizationId,
        currency: currencyUpper,
        status: 'DRAFT',
        payout_count: payees.length,
        total_amount: totalAmount,
        created_by: input.createdBy,
      },
    });

    for (const [participantId, group] of payees) {
      const defaultMethod = await tx.payout_methods.findFirst({
        where: {
          organization_id: input.organizationId,
          user_id: participantId,
          is_default: true,
          status: 'ACTIVE',
        },
      });

      await tx.payouts.create({
        data: {
          organization_id: input.organizationId,
          batch_id: batch.id,
          user_id: participantId,
          payout_method_id: defaultMethod?.id ?? undefined,
          currency: currencyUpper,
          gross_amount: group.amount,
          fee_amount: 0,
          net_amount: group.amount,
          status: 'DRAFT',
        },
      });

      const obligationIds = group.lines.map((l) => l.obligationId);
      await tx.deal_network_pilot_obligations.updateMany({
        where: { id: { in: obligationIds } },
        data: { status: DealNetworkPilotObligationStatus.PENDING_APPROVAL },
      });
    }

    return [batch];
  });

  return {
    batchId: batch.id,
    currency: batch.currency,
    status: batch.status,
    payoutCount: batch.payout_count,
    totalAmount: Number(batch.total_amount),
  };
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
