import 'server-only';

import { DealNetworkPilotObligationStatus } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { resolveOperationalCoordinationSnapshot } from '@/lib/operations/selectors/resolve-operational-coordination.server';
import { deriveReleaseBatchEligibility } from '@/lib/operations/selectors/derive-release-batch-eligibility';
import { assertBatchInvariants } from '@/lib/operations/dev/operational-invariants';
import {
  filterPilotReleaseBatchLines,
  scopeReleaseBatchToParticipants,
} from '@/lib/operations/payouts/scope-release-batch-participants';
import type { PilotReleaseBatchLine } from '@/lib/operations/payouts/pilot-release-batch-types';
import { buildPayoutRailCreateFields } from '@/lib/payouts/stamp-payout-rail';
import { isMerchantCregisSelectable } from '@/lib/payouts/rails/cregis-connection.server';
import { AuditEventType, AuditSeverity, createAuditLog } from '@/lib/audit/audit-log';

export type { PilotReleaseBatchLine } from '@/lib/operations/payouts/pilot-release-batch-types';

export type PilotReleaseBatchInput = {
  userId: string;
  organizationId: string;
  projectId?: string;
  currency: string;
  minThreshold?: number;
  /** When set, only these participants are included in derived lines. */
  participantIds?: string[];
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

  const scoped = scopeReleaseBatchToParticipants(eligibility, input.participantIds);
  const effectiveEligibility = scoped.ok ? scoped.scopedEligibility : eligibility;

  const lines: PilotReleaseBatchLine[] = [];
  const eligibleIds = effectiveEligibility.eligibleParticipants
    .map((row) => row.participantId)
    .filter(Boolean);
  const inFlightPayouts =
    eligibleIds.length > 0
      ? await prisma.payouts.findMany({
          where: {
            user_id: { in: eligibleIds },
            status: { in: ['DRAFT', 'SUBMITTED', 'PROCESSING'] },
          },
          select: { user_id: true },
        })
      : [];
  const inFlightParticipants = new Set(inFlightPayouts.map((row) => row.user_id));

  for (const eligible of effectiveEligibility.eligibleParticipants) {
    if (inFlightParticipants.has(eligible.participantId)) continue;
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
    eligibleParticipantCount: effectiveEligibility.participantCount,
    includedParticipantCount: effectiveEligibility.participantCount,
  });

  return filterPilotReleaseBatchLines(lines, input.participantIds);
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
  const merchant = await prisma.merchant_settings.findFirst({
    where: { organization_id: input.organizationId },
    select: { hedera_account_id: true },
  });
  const merchantHederaReady = Boolean(merchant?.hedera_account_id?.trim());
  const merchantCregisReady = await isMerchantCregisSelectable(input.organizationId);

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

      const railFields = buildPayoutRailCreateFields({
        organizationId: input.organizationId,
        currency: currencyUpper,
        methodType: defaultMethod?.method_type ?? null,
        merchantHederaReady,
        merchantCregisReady,
        destinationHandle: defaultMethod?.handle ?? null,
        destinationDetails:
          defaultMethod?.details && typeof defaultMethod.details === 'object'
            ? (defaultMethod.details as Record<string, unknown>)
            : null,
        payoutAmount: String(group.amount),
      });

      await tx.payouts.create({
        data: {
          id: railFields.id,
          organization_id: input.organizationId,
          batch_id: batch.id,
          user_id: participantId,
          payout_method_id: defaultMethod?.id ?? undefined,
          currency: currencyUpper,
          gross_amount: group.amount,
          fee_amount: 0,
          net_amount: group.amount,
          status: 'DRAFT',
          rail_id: railFields.rail_id,
          destination_kind: railFields.destination_kind,
          idempotency_key: railFields.idempotency_key,
        },
      });
    }

    return [batch];
  });

  void createAuditLog({
    eventType: AuditEventType.PAYOUT_CREATED,
    severity: AuditSeverity.INFO,
    userId: input.createdBy,
    organizationId: input.organizationId,
    resource: 'payout_batch',
    resourceId: batch.id,
    action: 'create',
    newValue: JSON.stringify({
      payoutCount: batch.payout_count,
      currency: batch.currency,
      totalAmount: Number(batch.total_amount),
    }),
    timestamp: new Date(),
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

  const scoped = scopeReleaseBatchToParticipants(eligibility, input.participantIds);
  if (!scoped.ok || scoped.scopedEligibility.participantCount === 0) {
    return { usePilot: false, lines: [], eligibleCount: 0 };
  }

  const lines = await derivePilotReleaseBatchLines(input);
  return {
    usePilot: lines.length > 0,
    lines,
    eligibleCount: scoped.scopedEligibility.participantCount,
  };
}
