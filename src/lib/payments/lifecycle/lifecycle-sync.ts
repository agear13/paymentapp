/**
 * Backfill lifecycle events from existing payment_events, fx_snapshots, xero_syncs, and ledger.
 * Idempotent — safe to call on every lifecycle read for legacy invoices.
 */

import type { PaymentEventType, PaymentLifecycleStage, XeroSyncType } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import {
  advanceLifecycle,
  createPendingSettlement,
  createLifecycleEvent,
} from '@/lib/payments/payment-lifecycle';

const log = loggers.payment;

const PAYMENT_EVENT_TO_LIFECYCLE: Partial<Record<PaymentEventType, PaymentLifecycleStage>> = {
  CREATED: 'INVOICE_CREATED',
  OPENED: 'CUSTOMER_OPENED_LINK',
  PAYMENT_INITIATED: 'PAYMENT_REQUESTED',
  PAYMENT_PENDING: 'PAYMENT_DETECTED',
  CRYPTO_PAYMENT_SUBMITTED: 'PAYMENT_DETECTED',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
};

function providerFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const record = metadata as Record<string, unknown>;
  return (
    (typeof record.wallet_provider === 'string' && record.wallet_provider) ||
    (typeof record.provider === 'string' && record.provider) ||
    null
  );
}

function accountingStageForSync(
  syncType: XeroSyncType,
  status: string
): PaymentLifecycleStage | null {
  if (status === 'RETRYING' || status === 'PENDING') {
    return 'ACCOUNTING_SYNC_STARTED';
  }
  if (status === 'SUCCESS') {
    return 'ACCOUNTING_SYNC_COMPLETED';
  }
  if (status === 'FAILED') {
    return 'ACCOUNTING_SYNC_FAILED';
  }
  return null;
}

export async function syncLifecycleFromExistingSources(
  paymentLinkId: string
): Promise<{ synced: number }> {
  const link = await prisma.payment_links.findUnique({
    where: { id: paymentLinkId },
    select: {
      id: true,
      organization_id: true,
      status: true,
      invoice_currency: true,
      payment_method: true,
      payment_events: {
        orderBy: { created_at: 'asc' },
        select: {
          id: true,
          event_type: true,
          payment_method: true,
          created_at: true,
          received_at: true,
          amount_received: true,
          currency_received: true,
          metadata: true,
          stripe_event_id: true,
          hedera_transaction_id: true,
          wise_transfer_id: true,
          correlation_id: true,
        },
      },
      fx_snapshots: {
        where: { snapshot_type: 'SETTLEMENT' },
        select: {
          id: true,
          base_currency: true,
          quote_currency: true,
          rate: true,
          provider: true,
          captured_at: true,
        },
      },
      ledger_entries: { select: { id: true }, take: 1 },
      xero_syncs: {
        select: {
          id: true,
          sync_type: true,
          status: true,
          xero_invoice_id: true,
          xero_payment_id: true,
          error_message: true,
          updated_at: true,
        },
      },
    },
  });

  if (!link) {
    return { synced: 0 };
  }

  let synced = 0;

  for (const event of link.payment_events) {
    const stage = PAYMENT_EVENT_TO_LIFECYCLE[event.event_type];
    if (!stage) continue;

    const idempotencySuffix =
      event.stripe_event_id ??
      event.hedera_transaction_id ??
      event.wise_transfer_id ??
      event.correlation_id ??
      event.id;

    const result = await createLifecycleEvent({
      paymentLinkId: link.id,
      organizationId: link.organization_id,
      stage,
      paymentEventId: event.id,
      idempotencyKey: `legacy:${event.event_type}:${idempotencySuffix}`,
      actor: 'system',
      provider: event.payment_method ?? providerFromMetadata(event.metadata),
      metadata: {
        source: 'payment_events_backfill',
        paymentEventType: event.event_type,
        ...(event.metadata && typeof event.metadata === 'object'
          ? (event.metadata as Record<string, unknown>)
          : {}),
      },
      createdAt: event.received_at ?? event.created_at,
    });

    if (result.created) synced += 1;

    if (event.event_type === 'PAYMENT_CONFIRMED') {
      const blockchainResult = await advanceLifecycle({
        paymentLinkId: link.id,
        organizationId: link.organization_id,
        stage: 'BLOCKCHAIN_CONFIRMED',
        paymentEventId: event.id,
        idempotencyKey: `legacy:blockchain_confirmed:${event.id}`,
        provider: event.payment_method ?? undefined,
        metadata: { source: 'payment_events_backfill' },
        createdAt: event.received_at ?? event.created_at,
      });
      if (blockchainResult.created) synced += 1;

      const amount = event.amount_received?.toString() ?? '0';
      const currency = event.currency_received ?? link.invoice_currency;

      await createPendingSettlement({
        paymentLinkId: link.id,
        paymentEventId: event.id,
        organizationId: link.organization_id,
        currency,
        amount,
        provider: event.payment_method ?? link.payment_method ?? 'MANUAL',
      });

      const settlementPending = await advanceLifecycle({
        paymentLinkId: link.id,
        organizationId: link.organization_id,
        stage: 'SETTLEMENT_PENDING',
        paymentEventId: event.id,
        idempotencyKey: `legacy:settlement_pending:${event.id}`,
        provider: event.payment_method ?? undefined,
        metadata: { source: 'payment_events_backfill' },
      });
      if (settlementPending.created) synced += 1;
    }
  }

  for (const snapshot of link.fx_snapshots) {
    const result = await advanceLifecycle({
      paymentLinkId: link.id,
      organizationId: link.organization_id,
      stage: 'FX_SNAPSHOT_LOCKED',
      idempotencyKey: `legacy:fx_locked:${snapshot.id}`,
      provider: snapshot.provider,
      metadata: {
        source: 'fx_snapshots_backfill',
        fxSnapshotId: snapshot.id,
        invoiceCurrency: snapshot.quote_currency,
        settlementCurrency: snapshot.base_currency,
        exchangeRate: Number(snapshot.rate),
        lockedAt: snapshot.captured_at.toISOString(),
        immutable: true,
      },
      createdAt: snapshot.captured_at,
    });
    if (result.created) synced += 1;
  }

  if (link.ledger_entries.length > 0) {
    const result = await advanceLifecycle({
      paymentLinkId: link.id,
      organizationId: link.organization_id,
      stage: 'LEDGER_UPDATED',
      idempotencyKey: 'legacy:ledger_updated',
      metadata: { source: 'ledger_entries_backfill' },
    });
    if (result.created) synced += 1;
  }

  for (const sync of link.xero_syncs) {
    const stage = accountingStageForSync(sync.sync_type, sync.status);
    if (!stage) continue;

    const result = await advanceLifecycle({
      paymentLinkId: link.id,
      organizationId: link.organization_id,
      stage,
      idempotencyKey: `legacy:xero:${sync.sync_type}:${sync.status}:${sync.id}`,
      provider: 'XERO',
      metadata: {
        source: 'xero_syncs_backfill',
        syncType: sync.sync_type,
        syncStatus: sync.status,
        xeroInvoiceId: sync.xero_invoice_id,
        xeroPaymentId: sync.xero_payment_id,
        errorMessage: sync.error_message,
      },
      createdAt: sync.updated_at,
    });
    if (result.created) synced += 1;
  }

  if (synced > 0) {
    log.info('Lifecycle backfill synced events', { paymentLinkId, synced });
  }

  return { synced };
}
