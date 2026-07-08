/**
 * Non-blocking lifecycle hooks — call from existing rails without changing their logic.
 */

import { loggers } from '@/lib/logger';
import {
  advanceLifecycle,
  createPendingSettlement,
  type CreateLifecycleEventInput,
} from '@/lib/payments/payment-lifecycle';

const log = loggers.payment;

function fireAndForget(label: string, fn: () => Promise<void>): void {
  void fn().catch((error: unknown) => {
    log.warn(`Lifecycle hook failed (${label})`, {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export function hookInvoiceCreatedLifecycle(params: {
  paymentLinkId: string;
  organizationId: string;
  actor?: string | null;
}): void {
  fireAndForget('invoice_created', async () => {
    await advanceLifecycle({
      paymentLinkId: params.paymentLinkId,
      organizationId: params.organizationId,
      stage: 'INVOICE_CREATED',
      actor: params.actor ?? 'system',
      provider: 'PROVVYPAY',
    });
  });
}

export function hookCustomerOpenedLinkLifecycle(params: {
  paymentLinkId: string;
  organizationId: string;
  metadata?: Record<string, unknown>;
}): void {
  fireAndForget('customer_opened_link', async () => {
    await advanceLifecycle({
      paymentLinkId: params.paymentLinkId,
      organizationId: params.organizationId,
      stage: 'CUSTOMER_OPENED_LINK',
      idempotencyKey: 'customer_opened_link',
      provider: 'PROVVYPAY',
      metadata: params.metadata,
    });
  });
}

export function hookPaymentRequestedLifecycle(params: {
  paymentLinkId: string;
  organizationId: string;
  paymentEventId?: string | null;
  provider?: string | null;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}): void {
  fireAndForget('payment_requested', async () => {
    await advanceLifecycle({
      paymentLinkId: params.paymentLinkId,
      organizationId: params.organizationId,
      stage: 'PAYMENT_REQUESTED',
      paymentEventId: params.paymentEventId,
      idempotencyKey: params.idempotencyKey,
      provider: params.provider,
      metadata: params.metadata,
    });
  });
}

export function hookPaymentDetectedLifecycle(params: {
  paymentLinkId: string;
  organizationId: string;
  paymentEventId?: string | null;
  provider?: string | null;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}): void {
  fireAndForget('payment_detected', async () => {
    await advanceLifecycle({
      paymentLinkId: params.paymentLinkId,
      organizationId: params.organizationId,
      stage: 'PAYMENT_DETECTED',
      paymentEventId: params.paymentEventId,
      idempotencyKey: params.idempotencyKey,
      provider: params.provider,
      metadata: params.metadata,
    });
  });
}

export function hookPaymentConfirmedLifecycle(params: {
  paymentLinkId: string;
  organizationId: string;
  paymentEventId: string;
  provider: string;
  currency: string;
  amount: string | number;
  metadata?: Record<string, unknown>;
}): void {
  fireAndForget('payment_confirmed', async () => {
    const idempotencyBase = `payment_confirmed:${params.paymentEventId}`;

    await advanceLifecycle({
      paymentLinkId: params.paymentLinkId,
      organizationId: params.organizationId,
      stage: 'PAYMENT_CONFIRMED',
      paymentEventId: params.paymentEventId,
      idempotencyKey: idempotencyBase,
      provider: params.provider,
      metadata: params.metadata,
    });

    await advanceLifecycle({
      paymentLinkId: params.paymentLinkId,
      organizationId: params.organizationId,
      stage: 'BLOCKCHAIN_CONFIRMED',
      paymentEventId: params.paymentEventId,
      idempotencyKey: `${idempotencyBase}:blockchain`,
      provider: params.provider,
      metadata: params.metadata,
    });

    await createPendingSettlement({
      paymentLinkId: params.paymentLinkId,
      paymentEventId: params.paymentEventId,
      organizationId: params.organizationId,
      currency: params.currency,
      amount: params.amount,
      provider: params.provider,
      metadata: params.metadata,
    });

    await advanceLifecycle({
      paymentLinkId: params.paymentLinkId,
      organizationId: params.organizationId,
      stage: 'SETTLEMENT_PENDING',
      paymentEventId: params.paymentEventId,
      idempotencyKey: `settlement_pending:${params.paymentEventId}`,
      provider: params.provider,
    });
  });
}

export function hookFxSnapshotLockedLifecycle(params: {
  paymentLinkId: string;
  organizationId: string;
  paymentEventId?: string | null;
  fxSnapshotId: string;
  invoiceCurrency: string;
  settlementCurrency: string;
  exchangeRate: number;
  provider: string;
  lockedAt?: Date;
}): void {
  fireAndForget('fx_snapshot_locked', async () => {
    await advanceLifecycle({
      paymentLinkId: params.paymentLinkId,
      organizationId: params.organizationId,
      stage: 'FX_SNAPSHOT_LOCKED',
      paymentEventId: params.paymentEventId,
      idempotencyKey: `fx_locked:${params.fxSnapshotId}`,
      provider: params.provider,
      createdAt: params.lockedAt,
      metadata: {
        fxSnapshotId: params.fxSnapshotId,
        invoiceCurrency: params.invoiceCurrency,
        settlementCurrency: params.settlementCurrency,
        exchangeRate: params.exchangeRate,
        immutable: true,
        lockedAt: (params.lockedAt ?? new Date()).toISOString(),
      },
    });
  });
}

export function hookLedgerUpdatedLifecycle(params: {
  paymentLinkId: string;
  organizationId: string;
  paymentEventId?: string | null;
  idempotencyKey?: string;
}): void {
  fireAndForget('ledger_updated', async () => {
    await advanceLifecycle({
      paymentLinkId: params.paymentLinkId,
      organizationId: params.organizationId,
      stage: 'LEDGER_UPDATED',
      paymentEventId: params.paymentEventId,
      idempotencyKey: params.idempotencyKey ?? 'ledger_updated',
      provider: 'PROVVYPAY',
    });
  });
}

export function hookAccountingSyncLifecycle(params: {
  paymentLinkId: string;
  organizationId: string;
  stage: Extract<
    CreateLifecycleEventInput['stage'],
    'ACCOUNTING_SYNC_STARTED' | 'ACCOUNTING_SYNC_COMPLETED' | 'ACCOUNTING_SYNC_FAILED'
  >;
  syncId: string;
  syncType: string;
  metadata?: Record<string, unknown>;
}): void {
  fireAndForget(`accounting_${params.stage}`, async () => {
    await advanceLifecycle({
      paymentLinkId: params.paymentLinkId,
      organizationId: params.organizationId,
      stage: params.stage,
      idempotencyKey: `xero:${params.syncType}:${params.stage}:${params.syncId}`,
      provider: 'XERO',
      metadata: {
        syncId: params.syncId,
        syncType: params.syncType,
        ...params.metadata,
      },
    });
  });
}

/** Post-commit enrichment after confirmPayment — FX lock, ledger, settlement timeline. */
export function hookPostPaymentConfirmationLifecycle(params: {
  paymentLinkId: string;
  paymentEventId: string;
  provider: string;
  currency: string;
  amount: number | string;
  metadata?: Record<string, unknown>;
}): void {
  fireAndForget('post_payment_confirmation', async () => {
    const { prisma } = await import('@/lib/server/prisma');
    const link = await prisma.payment_links.findUnique({
      where: { id: params.paymentLinkId },
      select: { organization_id: true },
    });
    if (!link) return;

    const idempotencyBase = `payment_confirmed:${params.paymentEventId}`;

    await advanceLifecycle({
      paymentLinkId: params.paymentLinkId,
      organizationId: link.organization_id,
      stage: 'PAYMENT_CONFIRMED',
      paymentEventId: params.paymentEventId,
      idempotencyKey: idempotencyBase,
      provider: params.provider,
      metadata: params.metadata,
    });

    await advanceLifecycle({
      paymentLinkId: params.paymentLinkId,
      organizationId: link.organization_id,
      stage: 'BLOCKCHAIN_CONFIRMED',
      paymentEventId: params.paymentEventId,
      idempotencyKey: `${idempotencyBase}:blockchain`,
      provider: params.provider,
      metadata: params.metadata,
    });

    await createPendingSettlement({
      paymentLinkId: params.paymentLinkId,
      paymentEventId: params.paymentEventId,
      organizationId: link.organization_id,
      currency: params.currency,
      amount: params.amount,
      provider: params.provider,
      metadata: params.metadata,
    });

    await advanceLifecycle({
      paymentLinkId: params.paymentLinkId,
      organizationId: link.organization_id,
      stage: 'SETTLEMENT_PENDING',
      paymentEventId: params.paymentEventId,
      idempotencyKey: `settlement_pending:${params.paymentEventId}`,
      provider: params.provider,
    });

    const snapshots = await prisma.fx_snapshots.findMany({
      where: {
        payment_link_id: params.paymentLinkId,
        snapshot_type: 'SETTLEMENT',
      },
      orderBy: { captured_at: 'desc' },
      take: 1,
    });

    const snapshot = snapshots[0];
    if (snapshot) {
      await advanceLifecycle({
        paymentLinkId: params.paymentLinkId,
        organizationId: link.organization_id,
        stage: 'FX_SNAPSHOT_LOCKED',
        paymentEventId: params.paymentEventId,
        idempotencyKey: `fx_locked:${snapshot.id}`,
        provider: snapshot.provider,
        createdAt: snapshot.captured_at,
        metadata: {
          fxSnapshotId: snapshot.id,
          invoiceCurrency: snapshot.quote_currency,
          settlementCurrency: snapshot.base_currency,
          exchangeRate: Number(snapshot.rate),
          immutable: true,
          lockedAt: snapshot.captured_at.toISOString(),
        },
      });
    }

    await advanceLifecycle({
      paymentLinkId: params.paymentLinkId,
      organizationId: link.organization_id,
      stage: 'LEDGER_UPDATED',
      paymentEventId: params.paymentEventId,
      idempotencyKey: `ledger_updated:${params.paymentEventId}`,
      provider: 'PROVVYPAY',
    });

    const fullLink = await prisma.payment_links.findUnique({
      where: { id: params.paymentLinkId },
      include: {
        payment_events: { where: { id: params.paymentEventId } },
      },
    });
    if (fullLink) {
      const { resolvePaymentTransactionLayers } = await import('@/lib/payments/payment-layers');
      const { buildXeroPaymentContextMetadata } = await import(
        '@/lib/payments/xero-payment-context'
      );
      const allSnapshots = await prisma.fx_snapshots.findMany({
        where: { payment_link_id: params.paymentLinkId },
      });
      const merchantSettings = await prisma.merchant_settings.findFirst({
        where: { organization_id: fullLink.organization_id },
        select: { default_currency: true },
      });
      const layers = resolvePaymentTransactionLayers({
        link: fullLink,
        paymentEvents: fullLink.payment_events,
        fxSnapshots: allSnapshots,
        merchantDefaultCurrency: merchantSettings?.default_currency ?? null,
      });
      const xeroContext = buildXeroPaymentContextMetadata(layers);

      await prisma.payment_links.update({
        where: { id: params.paymentLinkId },
        data: {
          settlement_currency: params.currency.toUpperCase(),
          settlement_amount: params.amount,
        },
      });

      await prisma.payment_events.update({
        where: { id: params.paymentEventId },
        data: {
          layer_metadata: xeroContext as object,
        },
      });

      if (snapshot) {
        await prisma.fx_snapshots.update({
          where: { id: snapshot.id },
          data: {
            payment_event_id: params.paymentEventId,
            commercial_currency: layers.commercial.currency,
            commercial_amount: layers.commercial.amount,
            accounting_currency: layers.accounting?.currency ?? layers.commercial.currency,
            accounting_amount: layers.accounting?.amount ?? layers.commercial.amount,
            settlement_currency: params.currency.toUpperCase(),
            settlement_amount: params.amount,
            valuation_method: layers.accounting?.valuationMethod ?? 'SETTLEMENT_LOCK',
          },
        });
      }
    }
  });
}
