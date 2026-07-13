/**
 * Payment Lifecycle & Settlement Engine — core service.
 * Append-only timeline; idempotent event creation; provider-agnostic stages.
 */

import { randomUUID } from 'crypto';
import type {
  PaymentLifecycleStage,
  PaymentSettlementStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import {
  LIFECYCLE_STAGE_LABELS,
  LIFECYCLE_STAGE_ORDER,
  maxLifecycleStage,
  merchantLayerTimelineLabel,
  MERCHANT_LAYER_TIMELINE_STAGES,
  PAYMENT_HEALTH_LABELS,
  TIMELINE_DISPLAY_STAGES,
  type LifecycleTimelineEntry,
  type PaymentHealthStatus,
} from '@/lib/payments/lifecycle/lifecycle-stages';
import {
  buildCustomerInvoiceLifecycleSnapshot,
  sumConfirmedPaymentAmounts,
} from '@/lib/payment-links/customer-invoice-lifecycle';
import {
  deriveCommercialReconciliation,
  COMMERCIAL_RECONCILIATION_STATUS_LABELS,
  type CommercialReconciliation,
} from '@/lib/commercial-reconciliation';
import {
  resolvePaymentTransactionLayers,
} from '@/lib/payments/payment-layers';
import { buildXeroPaymentContextMetadata } from '@/lib/payments/xero-payment-context';
import type {
  CreatePendingSettlementInput,
  MarkSettlementSettledInput,
  SettlementRecord,
} from '@/lib/payments/settlement/types';

const log = loggers.payment;

export type CreateLifecycleEventInput = {
  paymentLinkId: string;
  organizationId: string;
  stage: PaymentLifecycleStage;
  idempotencyKey: string;
  paymentEventId?: string | null;
  actor?: string | null;
  provider?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: Date;
  tx?: Prisma.TransactionClient;
};

export type AdvanceLifecycleInput = Omit<
  CreateLifecycleEventInput,
  'idempotencyKey'
> & {
  /** Defaults to `stage:${stage}` scoped per payment link. */
  idempotencyKey?: string;
};

function buildDefaultIdempotencyKey(
  paymentLinkId: string,
  stage: PaymentLifecycleStage,
  suffix?: string
): string {
  return suffix ? `${stage}:${suffix}` : `${stage}`;
}

export async function createLifecycleEvent(
  input: CreateLifecycleEventInput
): Promise<{ created: boolean; eventId: string }> {
  const db = input.tx ?? prisma;

  try {
    const row = await db.payment_lifecycle_events.create({
      data: {
        id: randomUUID(),
        payment_link_id: input.paymentLinkId,
        organization_id: input.organizationId,
        payment_event_id: input.paymentEventId ?? null,
        stage: input.stage,
        actor: input.actor ?? 'system',
        provider: input.provider ?? null,
        idempotency_key: input.idempotencyKey,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        created_at: input.createdAt ?? new Date(),
      },
    });
    return { created: true, eventId: row.id };
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      const existing = await db.payment_lifecycle_events.findFirst({
        where: {
          payment_link_id: input.paymentLinkId,
          idempotency_key: input.idempotencyKey,
        },
        select: { id: true },
      });
      return { created: false, eventId: existing?.id ?? '' };
    }
    throw error;
  }
}

export async function advanceLifecycle(
  input: AdvanceLifecycleInput
): Promise<{ created: boolean; eventId: string }> {
  const idempotencyKey =
    input.idempotencyKey ??
    buildDefaultIdempotencyKey(input.paymentLinkId, input.stage);

  return createLifecycleEvent({
    ...input,
    idempotencyKey,
  });
}

export async function currentLifecycleState(
  paymentLinkId: string
): Promise<PaymentLifecycleStage | null> {
  const events = await prisma.payment_lifecycle_events.findMany({
    where: { payment_link_id: paymentLinkId },
    select: { stage: true },
  });
  return maxLifecycleStage(events.map((event) => event.stage));
}

export async function isLifecycleComplete(paymentLinkId: string): Promise<boolean> {
  const state = await currentLifecycleState(paymentLinkId);
  return state === 'COMPLETED' || state === 'RECONCILED';
}

function toSettlementRecord(row: {
  id: string;
  payment_link_id: string;
  payment_event_id: string | null;
  status: PaymentSettlementStatus;
  currency: string;
  amount: Prisma.Decimal;
  destination: string | null;
  settled_at: Date | null;
  reference: string | null;
  provider: string | null;
  metadata: unknown;
  created_at: Date;
  updated_at: Date;
}): SettlementRecord {
  return {
    id: row.id,
    paymentLinkId: row.payment_link_id,
    paymentEventId: row.payment_event_id,
    status: row.status,
    currency: row.currency,
    amount: row.amount.toString(),
    destination: row.destination,
    settledAt: row.settled_at,
    reference: row.reference,
    provider: row.provider,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getSettlementsForPaymentLink(
  paymentLinkId: string
): Promise<SettlementRecord[]> {
  const rows = await prisma.payment_settlements.findMany({
    where: { payment_link_id: paymentLinkId },
    orderBy: { created_at: 'asc' },
  });
  return rows.map(toSettlementRecord);
}

export async function createPendingSettlement(
  input: CreatePendingSettlementInput,
  tx?: Prisma.TransactionClient
): Promise<SettlementRecord> {
  const db = tx ?? prisma;

  if (input.paymentEventId) {
    const existing = await db.payment_settlements.findFirst({
      where: { payment_event_id: input.paymentEventId },
    });
    if (existing) {
      return toSettlementRecord(existing);
    }
  }

  const row = await db.payment_settlements.create({
    data: {
      id: randomUUID(),
      payment_link_id: input.paymentLinkId,
      payment_event_id: input.paymentEventId ?? null,
      organization_id: input.organizationId,
      status: 'PENDING',
      currency: input.currency,
      amount: input.amount,
      destination: input.destination ?? null,
      provider: input.provider ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  return toSettlementRecord(row);
}

export async function markSettlementSettled(
  input: MarkSettlementSettledInput
): Promise<SettlementRecord> {
  const row = await prisma.payment_settlements.update({
    where: { id: input.settlementId },
    data: {
      status: 'SETTLED',
      settled_at: input.settledAt ?? new Date(),
      reference: input.reference ?? null,
      metadata: input.metadata
        ? (input.metadata as Prisma.InputJsonValue)
        : undefined,
      updated_at: new Date(),
    },
  });
  return toSettlementRecord(row);
}

export async function paymentTimeline(
  paymentLinkId: string
): Promise<LifecycleTimelineEntry[]> {
  const events = await prisma.payment_lifecycle_events.findMany({
    where: { payment_link_id: paymentLinkId },
    orderBy: { created_at: 'asc' },
  });

  const reachedStages = new Set(events.map((event) => event.stage));

  const entries: LifecycleTimelineEntry[] = events.map((event) => ({
    id: event.id,
    stage: event.stage,
    label: LIFECYCLE_STAGE_LABELS[event.stage],
    createdAt: event.created_at,
    actor: event.actor,
    provider: event.provider,
    paymentEventId: event.payment_event_id,
    metadata: (event.metadata as Record<string, unknown> | null) ?? null,
    reached: true,
  }));

  for (const stage of TIMELINE_DISPLAY_STAGES) {
    if (!reachedStages.has(stage)) {
      entries.push({
        id: `pending-${stage}`,
        stage,
        label: LIFECYCLE_STAGE_LABELS[stage],
        createdAt: new Date(0),
        actor: null,
        provider: null,
        paymentEventId: null,
        metadata: null,
        reached: false,
      });
    }
  }

  return entries.sort((a, b) => {
    const orderDiff =
      LIFECYCLE_STAGE_ORDER.indexOf(a.stage) - LIFECYCLE_STAGE_ORDER.indexOf(b.stage);
    if (orderDiff !== 0) return orderDiff;
    if (a.reached && b.reached) {
      return a.createdAt.getTime() - b.createdAt.getTime();
    }
    return a.reached ? -1 : 1;
  });
}

export function derivePaymentHealth(input: {
  linkStatus: string;
  currentStage: PaymentLifecycleStage | null;
  settlements: SettlementRecord[];
  hasFailedAccountingSync?: boolean;
}): PaymentHealthStatus {
  const { linkStatus, currentStage, settlements, hasFailedAccountingSync } = input;

  if (currentStage === 'COMPLETED' || currentStage === 'RECONCILED') {
    return currentStage === 'RECONCILED' ? 'RECONCILED' : 'COMPLETED';
  }

  if (settlements.some((s) => s.status === 'FAILED')) {
    return 'SETTLEMENT_FAILED';
  }

  if (settlements.some((s) => s.status === 'RECONCILED')) {
    return 'RECONCILED';
  }

  const isPaid =
    linkStatus === 'PAID' ||
    linkStatus === 'PAID_UNVERIFIED' ||
    linkStatus === 'REQUIRES_REVIEW' ||
    linkStatus === 'PARTIALLY_REFUNDED';

  if (
    isPaid &&
    settlements.some((s) => s.status === 'PENDING' || s.status === 'IN_PROGRESS')
  ) {
    return 'AWAITING_SETTLEMENT';
  }

  if (
    isPaid ||
    currentStage === 'PAYMENT_CONFIRMED' ||
    currentStage === 'FX_SNAPSHOT_LOCKED' ||
    currentStage === 'LEDGER_UPDATED' ||
    currentStage === 'ACCOUNTING_SYNC_STARTED' ||
    currentStage === 'ACCOUNTING_SYNC_COMPLETED'
  ) {
    if (hasFailedAccountingSync) {
      return 'PROCESSING';
    }
    return settlements.length > 0 ? 'AWAITING_SETTLEMENT' : 'PROCESSING';
  }

  if (
    currentStage === 'PAYMENT_REQUESTED' ||
    currentStage === 'PAYMENT_DETECTED'
  ) {
    return 'PROCESSING';
  }

  if (linkStatus === 'OPEN') {
    return 'AWAITING_PAYMENT';
  }

  return 'AWAITING_PAYMENT';
}

export function paymentHealthLabel(health: PaymentHealthStatus): string {
  return PAYMENT_HEALTH_LABELS[health];
}

export async function getPaymentLifecycleSnapshot(paymentLinkId: string) {
  const link = await prisma.payment_links.findUnique({
    where: { id: paymentLinkId },
    select: {
      id: true,
      status: true,
      organization_id: true,
      amount: true,
      currency: true,
      created_at: true,
      pilot_deal_id: true,
      payment_method: true,
      invoice_currency: true,
      commercial_currency: true,
      commercial_amount: true,
      accounting_currency: true,
      accounting_amount: true,
      settlement_currency: true,
      settlement_amount: true,
      base_currency: true,
      base_amount: true,
      payment_method: true,
      payment_events: {
        orderBy: { created_at: 'asc' },
        select: {
          id: true,
          event_type: true,
          payment_method: true,
          amount_received: true,
          currency_received: true,
          hedera_transaction_id: true,
          stripe_payment_intent_id: true,
          wise_transfer_id: true,
          source_reference: true,
          correlation_id: true,
          received_at: true,
          created_at: true,
          metadata: true,
          layer_metadata: true,
          pilot_deal_id: true,
        },
      },
    },
  });

  if (!link) {
    return null;
  }

  const [timeline, settlements, currentStage, fxSnapshots, merchantSettings, xeroSyncs, paymentSettlements] =
    await Promise.all([
      paymentTimeline(paymentLinkId),
      getSettlementsForPaymentLink(paymentLinkId),
      currentLifecycleState(paymentLinkId),
      prisma.fx_snapshots.findMany({
        where: { payment_link_id: paymentLinkId },
        orderBy: { captured_at: 'asc' },
      }),
      prisma.merchant_settings.findFirst({
        where: { organization_id: link.organization_id },
        select: {
          default_currency: true,
          xero_stripe_clearing_account_id: true,
          xero_wise_clearing_account_id: true,
          xero_hbar_clearing_account_id: true,
          xero_usdc_clearing_account_id: true,
        },
      }),
      prisma.xero_syncs.findMany({
        where: { payment_link_id: paymentLinkId },
        select: {
          sync_type: true,
          status: true,
          xero_invoice_id: true,
          xero_payment_id: true,
          updated_at: true,
        },
      }),
      prisma.payment_settlements.findMany({
        where: { payment_link_id: paymentLinkId },
        select: {
          status: true,
          settled_at: true,
          reference: true,
          provider: true,
        },
      }),
    ]);

  const transactionLayers = resolvePaymentTransactionLayers({
    link,
    paymentEvents: link.payment_events,
    fxSnapshots,
    merchantDefaultCurrency: merchantSettings?.default_currency ?? null,
  });

  const xeroContext = buildXeroPaymentContextMetadata(transactionLayers);

  const invoiceSync = xeroSyncs.find((s) => s.sync_type === 'INVOICE') ?? null;
  const paymentSync = xeroSyncs.find((s) => s.sync_type === 'PAYMENT') ?? null;
  const amountPaid = sumConfirmedPaymentAmounts(link.payment_events);
  const paymentConfirmedEvent = link.payment_events.find(
    (e) => e.event_type === 'PAYMENT_CONFIRMED'
  );
  const settlementPendingEvent = timeline.find(
    (e) => e.stage === 'SETTLEMENT_PENDING' && e.reached
  );

  const clearingOverrides = merchantSettings
    ? {
        xero_stripe_clearing_account_id:
          merchantSettings.xero_stripe_clearing_account_id ?? undefined,
        xero_wise_clearing_account_id:
          merchantSettings.xero_wise_clearing_account_id ?? undefined,
        xero_hbar_clearing_account_id:
          merchantSettings.xero_hbar_clearing_account_id ?? undefined,
        xero_usdc_clearing_account_id:
          merchantSettings.xero_usdc_clearing_account_id ?? undefined,
      }
    : undefined;

  const commercialReconciliation: CommercialReconciliation = deriveCommercialReconciliation({
    paymentLinkId: link.id,
    invoiceAmount: Number(link.amount),
    currency: link.invoice_currency ?? link.currency,
    organizationId: link.organization_id,
    agreementId: link.pilot_deal_id,
    linkStatus: link.status,
    paymentEvents: [],
    rawPaymentEvents: link.payment_events.map((e) => ({
      ...e,
      payment_link_id: link.id,
    })),
    bankSettlements: paymentSettlements.map((s) => ({
      status: s.status,
      settledAt: s.settled_at,
      reference: s.reference,
      provider: s.provider,
    })),
    clearingAccountOverrides: clearingOverrides,
  });

  const commerciallyReconciledAt = commercialReconciliation.reconciledAt
    ? new Date(commercialReconciliation.reconciledAt)
    : null;
  const bankClearedAt =
    commercialReconciliation.bankSettlement?.status === 'cleared' &&
    commercialReconciliation.bankSettlement.settledAt
      ? new Date(commercialReconciliation.bankSettlement.settledAt)
      : null;

  const invoiceLifecycle = buildCustomerInvoiceLifecycleSnapshot({
    linkStatus: link.status,
    invoiceAmount: Number(link.amount),
    amountPaid,
    invoiceSync: invoiceSync
      ? {
          syncType: 'INVOICE',
          status: invoiceSync.status,
          xeroInvoiceId: invoiceSync.xero_invoice_id,
          updatedAt: invoiceSync.updated_at,
        }
      : null,
    paymentSync: paymentSync
      ? {
          syncType: 'PAYMENT',
          status: paymentSync.status,
          xeroPaymentId: paymentSync.xero_payment_id,
          updatedAt: paymentSync.updated_at,
        }
      : null,
    createdAt: link.created_at,
    exportedAt:
      invoiceSync?.status === 'SUCCESS' ? invoiceSync.updated_at : null,
    paymentConfirmedAt: paymentConfirmedEvent
      ? timeline.find((e) => e.stage === 'PAYMENT_CONFIRMED' && e.reached)?.createdAt ??
        null
      : null,
    settlementReadyAt: settlementPendingEvent?.createdAt ?? null,
    commerciallyReconciledAt,
    bankClearedAt,
  });

  const invoiceExportReached =
    invoiceSync?.status === 'SUCCESS' ||
    timeline.some(
      (entry) =>
        entry.stage === 'ACCOUNTING_SYNC_COMPLETED' &&
        entry.reached &&
        (entry.metadata as Record<string, unknown> | null)?.syncType === 'INVOICE'
    );

  const layerTimeline = MERCHANT_LAYER_TIMELINE_STAGES.map(({ stage, label }) => {
    let reached = timeline.find((entry) => entry.stage === stage && entry.reached);
    if (stage === 'ACCOUNTING_SYNC_COMPLETED' && label === 'Invoice Exported') {
      reached = invoiceExportReached
        ? {
            ...(reached ?? {
              id: 'invoice-export',
              stage,
              label,
              createdAt: invoiceSync?.updated_at ?? link.created_at,
              actor: null,
              provider: 'XERO',
              paymentEventId: null,
              metadata: { syncType: 'INVOICE' },
              reached: true,
            }),
            reached: true,
          }
        : undefined;
    }
    if (stage === 'CUSTOMER_OPENED_LINK' && label === 'Awaiting Payment') {
      const awaiting =
        invoiceExportReached &&
        (link.status === 'OPEN' ||
          link.status === 'PAID_UNVERIFIED' ||
          link.status === 'REQUIRES_REVIEW');
      if (awaiting) {
        reached = {
          id: 'awaiting-payment',
          stage,
          label,
          createdAt: invoiceSync?.updated_at ?? link.created_at,
          actor: null,
          provider: null,
          paymentEventId: null,
          metadata: null,
          reached: true,
        };
      }
    }
    return {
      stage,
      label,
      reached: Boolean(reached),
      createdAt: reached?.createdAt ?? null,
    };
  });

  const hasFailedAccountingSync = timeline.some(
    (entry) => entry.stage === 'ACCOUNTING_SYNC_FAILED' && entry.reached
  );

  const health = derivePaymentHealth({
    linkStatus: link.status,
    currentStage,
    settlements,
    hasFailedAccountingSync,
  });

  return {
    paymentLinkId: link.id,
    organizationId: link.organization_id,
    linkStatus: link.status,
    currentStage,
    health,
    healthLabel: paymentHealthLabel(health),
    timeline: timeline.map((entry) => ({
      ...entry,
      label: merchantLayerTimelineLabel(entry.stage),
    })),
    layerTimeline,
    invoiceLifecycle,
    commercialReconciliation: {
      reconciliationStatus: commercialReconciliation.reconciliationStatus,
      reconciliationStatusLabel:
        COMMERCIAL_RECONCILIATION_STATUS_LABELS[
          commercialReconciliation.reconciliationStatus
        ],
      settlementEligible: commercialReconciliation.settlementEligible,
      paymentRail: commercialReconciliation.paymentRail,
      matchedAmount: commercialReconciliation.matchedAmount,
      remainingAmount: commercialReconciliation.remainingAmount,
    },
    transactionLayers,
    xeroContext,
    settlements,
    fxSnapshots: fxSnapshots.map((snapshot) => ({
      id: snapshot.id,
      snapshotType: snapshot.snapshot_type,
      commercialCurrency: snapshot.commercial_currency ?? transactionLayers.commercial.currency,
      commercialAmount: snapshot.commercial_amount?.toString() ?? transactionLayers.commercial.amount,
      accountingCurrency:
        snapshot.accounting_currency ??
        transactionLayers.accounting?.currency ??
        snapshot.quote_currency,
      accountingAmount:
        snapshot.accounting_amount?.toString() ?? transactionLayers.accounting?.amount ?? null,
      settlementCurrency: snapshot.settlement_currency ?? transactionLayers.settlement?.currency ?? null,
      settlementAmount:
        snapshot.settlement_amount?.toString() ?? transactionLayers.settlement?.amount ?? null,
      exchangeRate: Number(snapshot.rate),
      provider: snapshot.provider,
      valuationMethod: snapshot.valuation_method,
      lockedAt: snapshot.captured_at,
      immutable: true as const,
    })),
  };
}

export function paymentHealth(input: Parameters<typeof derivePaymentHealth>[0]): PaymentHealthStatus {
  return derivePaymentHealth(input);
}

export async function recordManualSettlementCompleted(params: {
  paymentLinkId: string;
  organizationId: string;
  settlementId: string;
  actor: string;
  reference?: string | null;
}): Promise<void> {
  await markSettlementSettled({
    settlementId: params.settlementId,
    reference: params.reference,
  });

  await advanceLifecycle({
    paymentLinkId: params.paymentLinkId,
    organizationId: params.organizationId,
    stage: 'SETTLEMENT_COMPLETED',
    idempotencyKey: `settlement_completed:${params.settlementId}`,
    actor: params.actor,
    provider: 'MANUAL',
    metadata: { settlementId: params.settlementId, reference: params.reference ?? null },
  });

  log.info('Manual settlement marked complete', {
    paymentLinkId: params.paymentLinkId,
    settlementId: params.settlementId,
    actor: params.actor,
  });
}
