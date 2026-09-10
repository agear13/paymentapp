import 'server-only';

import type { PayoutStatus, Prisma, payouts } from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { AuditEventType, AuditSeverity, createAuditLog } from '@/lib/audit/audit-log';
import { log } from '@/lib/logger';
import { prisma } from '@/lib/server/prisma';
import {
  PayoutReleaseError,
  assertCanTransitionPayoutStatus,
} from '@/lib/payouts/payout-status-transitions';
import type {
  CanonicalPayoutEvent,
  CanonicalPayoutInstruction,
  PayoutRailExecutionContext,
  PayoutRailId,
} from '@/lib/payouts/rails/types';
import { isPayoutRailId } from '@/lib/payouts/rails/types';
import { getPayoutRailAdapter } from '@/lib/payouts/rails/adapters';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

export type PayoutReleaseActor = {
  userId?: string | null;
  organizationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
};

export type ExecutePayoutReleaseCommand =
  | { type: 'submit_batch'; batchId: string; actor: PayoutReleaseActor }
  | { type: 'mark_processing'; payoutIds: string[]; actor?: PayoutReleaseActor; providerPayload?: Record<string, unknown> | null }
  | { type: 'apply_event'; event: CanonicalPayoutEvent; actor?: PayoutReleaseActor }
  | { type: 'apply_events'; events: CanonicalPayoutEvent[]; actor?: PayoutReleaseActor }
  | {
      type: 'execute';
      payoutId: string;
      actor: PayoutReleaseActor;
      context?: PayoutRailExecutionContext;
    }
  | {
      type: 'sync';
      payoutId: string;
      actor?: PayoutReleaseActor;
      context?: PayoutRailExecutionContext;
    };

export type ExecutePayoutReleaseResult = {
  payoutIds: string[];
  statuses: PayoutStatus[];
  batchId?: string;
  batchStatus?: string;
};

function jsonValue(
  value: Record<string, unknown> | null | undefined
): Prisma.InputJsonValue | typeof PrismaNamespace.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return PrismaNamespace.JsonNull;
  return value as Prisma.InputJsonValue;
}

function asDetailsRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function toCanonicalPayoutInstruction(
  payout: payouts & {
    payout_methods?: {
      id: string;
      method_type: CanonicalPayoutInstruction['destination']['methodType'];
      handle: string | null;
      details?: unknown;
    } | null;
  }
): CanonicalPayoutInstruction {
  if (!isPayoutRailId(payout.rail_id)) {
    throw new PayoutReleaseError('UNKNOWN_PAYOUT_RAIL', `Unknown payout rail: ${payout.rail_id}`);
  }
  return {
    payoutId: payout.id,
    organizationId: payout.organization_id,
    batchId: payout.batch_id,
    payeeUserId: payout.user_id,
    amount: payout.net_amount.toString(),
    currency: payout.currency,
    destinationKind: payout.destination_kind,
    railId: payout.rail_id as PayoutRailId,
    idempotencyKey: payout.idempotency_key,
    providerReference: payout.external_reference,
    status: payout.status,
    destination: {
      kind: payout.destination_kind,
      payoutMethodId: payout.payout_method_id,
      methodType: payout.payout_methods?.method_type ?? null,
      handle: payout.payout_methods?.handle ?? null,
      details: asDetailsRecord(payout.payout_methods?.details),
    },
  };
}

async function loadPayout(
  db: PrismaClientOrTx,
  event: CanonicalPayoutEvent
): Promise<payouts> {
  if (event.payoutId) {
    const payout = await db.payouts.findUnique({ where: { id: event.payoutId } });
    if (!payout) {
      throw new PayoutReleaseError('PAYOUT_NOT_FOUND', 'Payout not found', 404);
    }
    return payout;
  }
  if (event.idempotencyKey) {
    const payout = await db.payouts.findUnique({
      where: { idempotency_key: event.idempotencyKey },
    });
    if (!payout) {
      throw new PayoutReleaseError('PAYOUT_NOT_FOUND', 'Payout not found', 404);
    }
    return payout;
  }
  if (event.providerReference) {
    const payout = await db.payouts.findFirst({
      where: { external_reference: event.providerReference },
    });
    if (payout) return payout;
  }
  throw new PayoutReleaseError(
    'PAYOUT_EVENT_UNADDRESSED',
    'Canonical payout event requires payoutId, idempotencyKey, or a stored providerReference'
  );
}

async function syncPilotPaid(
  tx: Prisma.TransactionClient,
  userId: string,
  paidAt: Date
): Promise<void> {
  const pilotParticipant = await tx.deal_network_pilot_participants.findUnique({
    where: { id: userId },
  });
  if (!pilotParticipant) return;

  const payload = pilotParticipant.participant_payload as unknown as DemoParticipant;
  const paidPayload: DemoParticipant = {
    ...payload,
    payoutSettlementStatus: 'Paid',
    payoutPaidAt: paidAt.toISOString(),
  };
  await tx.deal_network_pilot_participants.update({
    where: { id: pilotParticipant.id },
    data: { participant_payload: paidPayload as unknown as Prisma.InputJsonValue },
  });
  await tx.deal_network_pilot_obligations.updateMany({
    where: { participant_id: pilotParticipant.id },
    data: { status: 'PAID' },
  });
}

export async function maybeCompletePayoutBatch(
  tx: Prisma.TransactionClient,
  batchId: string
): Promise<{ completed: boolean }> {
  const openCount = await tx.payouts.count({
    where: {
      batch_id: batchId,
      status: { notIn: ['PAID', 'FAILED'] },
    },
  });
  if (openCount > 0) return { completed: false };

  await tx.payout_batches.update({
    where: { id: batchId },
    data: { status: 'COMPLETED', completed_at: new Date() },
  });
  return { completed: true };
}

async function applyPaid(
  tx: Prisma.TransactionClient,
  payout: payouts,
  event: CanonicalPayoutEvent
): Promise<payouts> {
  if (payout.status === 'PAID') return payout;
  assertCanTransitionPayoutStatus(payout.status, 'PAID');
  const paidAt = event.occurredAt ?? new Date();

  const updated = await tx.payouts.update({
    where: { id: payout.id },
    data: {
      status: 'PAID',
      external_reference: event.providerReference ?? payout.external_reference,
      paid_at: paidAt,
      failed_reason: null,
      provider_payload: jsonValue(event.providerPayload ?? undefined),
    },
  });

  await tx.commission_obligation_lines.updateMany({
    where: { payout_id: payout.id },
    data: { status: 'PAID', paid_at: paidAt },
  });
  await tx.commission_obligation_items.updateMany({
    where: { payout_id: payout.id },
    data: { status: 'PAID', paid_at: paidAt },
  });
  await syncPilotPaid(tx, payout.user_id, paidAt);
  await maybeCompletePayoutBatch(tx, payout.batch_id);
  return updated;
}

async function applyFailed(
  tx: Prisma.TransactionClient,
  payout: payouts,
  event: CanonicalPayoutEvent
): Promise<payouts> {
  if (payout.status === 'FAILED') return payout;
  assertCanTransitionPayoutStatus(payout.status, 'FAILED');

  const updated = await tx.payouts.update({
    where: { id: payout.id },
    data: {
      status: 'FAILED',
      failed_reason: event.failedReason ?? 'Payout failed',
      provider_payload: jsonValue(event.providerPayload ?? undefined),
      external_reference: event.providerReference ?? payout.external_reference,
    },
  });

  await tx.commission_obligation_lines.updateMany({
    where: { payout_id: payout.id },
    data: { payout_id: null, status: 'POSTED', paid_at: null },
  });
  await tx.commission_obligation_items.updateMany({
    where: { payout_id: payout.id, status: { not: 'PAID' } },
    data: { payout_id: null },
  });
  await maybeCompletePayoutBatch(tx, payout.batch_id);
  return updated;
}

async function applyProcessing(
  tx: Prisma.TransactionClient,
  payout: payouts,
  event: CanonicalPayoutEvent
): Promise<payouts> {
  if (payout.status === 'PROCESSING') {
    if (event.providerPayload) {
      return tx.payouts.update({
        where: { id: payout.id },
        data: { provider_payload: jsonValue(event.providerPayload) },
      });
    }
    return payout;
  }
  assertCanTransitionPayoutStatus(payout.status, 'PROCESSING');
  return tx.payouts.update({
    where: { id: payout.id },
    data: {
      status: 'PROCESSING',
      external_reference: event.providerReference ?? payout.external_reference,
      provider_payload: jsonValue(event.providerPayload ?? undefined),
    },
  });
}

function auditForStatus(status: PayoutStatus): AuditEventType | null {
  if (status === 'PAID') return AuditEventType.PAYOUT_PAID;
  if (status === 'FAILED') return AuditEventType.PAYOUT_FAILED;
  if (status === 'SUBMITTED') return AuditEventType.PAYOUT_APPROVED;
  return null;
}

async function emitPayoutAudit(input: {
  payout: payouts;
  previousStatus: PayoutStatus;
  nextStatus: PayoutStatus;
  actor?: PayoutReleaseActor;
}): Promise<void> {
  const eventType = auditForStatus(input.nextStatus);
  if (!eventType) return;
  void createAuditLog({
    eventType,
    severity: input.nextStatus === 'FAILED' ? AuditSeverity.WARNING : AuditSeverity.INFO,
    userId: input.actor?.userId ?? undefined,
    organizationId: input.actor?.organizationId ?? input.payout.organization_id,
    resource: 'payout',
    resourceId: input.payout.id,
    action: input.nextStatus.toLowerCase(),
    oldValue: JSON.stringify({ status: input.previousStatus }),
    newValue: JSON.stringify({
      status: input.nextStatus,
      railId: input.payout.rail_id,
      externalReference: input.payout.external_reference,
    }),
    ipAddress: input.actor?.ipAddress ?? undefined,
    userAgent: input.actor?.userAgent ?? undefined,
    correlationId: input.actor?.correlationId ?? undefined,
    timestamp: new Date(),
  });
}

async function applyCanonicalEventInTx(
  tx: Prisma.TransactionClient,
  event: CanonicalPayoutEvent,
  actor?: PayoutReleaseActor
): Promise<payouts> {
  const payout = await loadPayout(tx, event);
  if (
    (payout.status === 'PAID' || payout.status === 'FAILED') &&
    event.status !== payout.status
  ) {
    log.info('Ignoring stale payout event', {
      payoutId: payout.id,
      currentStatus: payout.status,
      eventStatus: event.status,
      railId: payout.rail_id,
    });
    return payout;
  }
  const previous = payout.status;
  let updated: payouts;
  if (event.status === 'PAID') updated = await applyPaid(tx, payout, event);
  else if (event.status === 'FAILED') updated = await applyFailed(tx, payout, event);
  else updated = await applyProcessing(tx, payout, event);

  if (previous !== updated.status) {
    log.info('Payout release status applied', {
      payoutId: updated.id,
      batchId: updated.batch_id,
      railId: updated.rail_id,
      from: previous,
      to: updated.status,
    });
    await emitPayoutAudit({
      payout: updated,
      previousStatus: previous,
      nextStatus: updated.status,
      actor,
    });
  }
  return updated;
}

async function submitBatchInTx(
  tx: Prisma.TransactionClient,
  batchId: string,
  actor: PayoutReleaseActor
): Promise<ExecutePayoutReleaseResult> {
  const batch = await tx.payout_batches.findUnique({
    where: { id: batchId },
    include: { payouts: true },
  });
  if (!batch) {
    throw new PayoutReleaseError('BATCH_NOT_FOUND', 'Payout batch not found', 404);
  }
  if (batch.status !== 'DRAFT' && batch.status !== 'SUBMITTED') {
    throw new PayoutReleaseError('BATCH_NOT_DRAFT', `Batch is already ${batch.status}`);
  }

  const now = new Date();
  if (batch.status === 'DRAFT') {
    await tx.payout_batches.update({
      where: { id: batchId },
      data: { status: 'SUBMITTED', submitted_at: now },
    });
  }
  await tx.payouts.updateMany({
    where: { batch_id: batchId, status: 'DRAFT' },
    data: { status: 'SUBMITTED' },
  });

  const payouts = await tx.payouts.findMany({ where: { batch_id: batchId } });
  void createAuditLog({
    eventType: AuditEventType.PAYOUT_APPROVED,
    severity: AuditSeverity.INFO,
    userId: actor.userId ?? undefined,
    organizationId: actor.organizationId ?? batch.organization_id,
    resource: 'payout_batch',
    resourceId: batchId,
    action: 'submit',
    oldValue: JSON.stringify({ status: batch.status }),
    newValue: JSON.stringify({ status: 'SUBMITTED', payoutCount: payouts.length }),
    ipAddress: actor.ipAddress ?? undefined,
    userAgent: actor.userAgent ?? undefined,
    correlationId: actor.correlationId ?? undefined,
    timestamp: now,
  });

  return {
    payoutIds: payouts.map((row) => row.id),
    statuses: payouts.map((row) => row.status),
    batchId,
    batchStatus: 'SUBMITTED',
  };
}

export async function listCanonicalPayoutInstructionsForBatch(
  batchId: string
): Promise<CanonicalPayoutInstruction[]> {
  const rows = await prisma.payouts.findMany({
    where: { batch_id: batchId },
    include: {
      payout_methods: {
        select: { id: true, method_type: true, handle: true, details: true, hedera_account_id: true },
      },
    },
  });
  return rows.map(toCanonicalPayoutInstruction);
}

/**
 * Canonical outbound payout orchestrator. Adapters must not write payout or
 * obligation status; they return events, and this function applies them.
 */
const payoutMethodSelect = {
  id: true,
  method_type: true,
  handle: true,
  details: true,
} as const;

async function loadPayoutForRail(payoutId: string) {
  const payout = await prisma.payouts.findUnique({
    where: { id: payoutId },
    include: { payout_methods: { select: payoutMethodSelect } },
  });
  if (!payout) {
    throw new PayoutReleaseError('PAYOUT_NOT_FOUND', 'Payout not found', 404);
  }
  return payout;
}

function adapterResultToEvent(
  payoutId: string,
  idempotencyKey: string,
  railId: PayoutRailId,
  result: {
    providerReference: string | null;
    status: 'SUBMITTED' | 'PROCESSING' | 'PAID' | 'FAILED';
    failedReason?: string | null;
    providerPayload?: Record<string, unknown> | null;
  }
): CanonicalPayoutEvent | null {
  if (result.status === 'SUBMITTED') return null;
  return {
    payoutId,
    idempotencyKey,
    railId,
    providerReference: result.providerReference,
    status: result.status,
    failedReason: result.failedReason ?? null,
    providerPayload: result.providerPayload ?? null,
  };
}

async function executePayoutOnRail(
  payoutId: string,
  actor: PayoutReleaseActor,
  context?: PayoutRailExecutionContext
): Promise<ExecutePayoutReleaseResult> {
  const payout = await loadPayoutForRail(payoutId);
  if (payout.status === 'PAID' || payout.status === 'FAILED') {
    return { payoutIds: [payout.id], statuses: [payout.status], batchId: payout.batch_id };
  }
  if (payout.status === 'DRAFT') {
    throw new PayoutReleaseError(
      'PAYOUT_NOT_SUBMITTED',
      'Submit the payout batch before executing a rail payout'
    );
  }

  const instruction = toCanonicalPayoutInstruction(payout);
  const adapter = getPayoutRailAdapter(instruction.railId);
  const result = await adapter.submit(instruction, context);
  const event = adapterResultToEvent(
    payout.id,
    payout.idempotency_key,
    instruction.railId,
    result
  );
  if (!event) {
    return { payoutIds: [payout.id], statuses: [payout.status], batchId: payout.batch_id };
  }
  return executePayoutRelease({ type: 'apply_event', event, actor });
}

async function syncPayoutOnRail(
  payoutId: string,
  actor?: PayoutReleaseActor,
  context?: PayoutRailExecutionContext
): Promise<ExecutePayoutReleaseResult> {
  const payout = await loadPayoutForRail(payoutId);
  const instruction = toCanonicalPayoutInstruction(payout);
  const adapter = getPayoutRailAdapter(instruction.railId);
  const result = await adapter.syncStatus(instruction, context);
  const event = adapterResultToEvent(
    payout.id,
    payout.idempotency_key,
    instruction.railId,
    result
  );
  if (!event) {
    return { payoutIds: [payout.id], statuses: [payout.status], batchId: payout.batch_id };
  }
  return executePayoutRelease({ type: 'apply_event', event, actor });
}

export async function executePayoutRelease(
  command: ExecutePayoutReleaseCommand
): Promise<ExecutePayoutReleaseResult> {
  if (command.type === 'submit_batch') {
    return prisma.$transaction((tx) => submitBatchInTx(tx, command.batchId, command.actor));
  }

  if (command.type === 'execute') {
    return executePayoutOnRail(command.payoutId, command.actor, command.context);
  }

  if (command.type === 'sync') {
    return syncPayoutOnRail(command.payoutId, command.actor, command.context);
  }

  if (command.type === 'mark_processing') {
    const events: CanonicalPayoutEvent[] = command.payoutIds.map((payoutId) => ({
      payoutId,
      providerReference: null,
      status: 'PROCESSING',
      providerPayload: command.providerPayload ?? null,
    }));
    return executePayoutRelease({ type: 'apply_events', events, actor: command.actor });
  }

  const events = command.type === 'apply_event' ? [command.event] : command.events;
  if (events.length === 0) {
    return { payoutIds: [], statuses: [] };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const rows: payouts[] = [];
    for (const event of events) {
      rows.push(await applyCanonicalEventInTx(tx, event, command.actor));
    }
    return rows;
  });

  return {
    payoutIds: updated.map((row) => row.id),
    statuses: updated.map((row) => row.status),
    batchId: updated[0]?.batch_id,
  };
}
