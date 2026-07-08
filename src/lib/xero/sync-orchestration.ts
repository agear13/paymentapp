/**
 * Xero Sync Orchestration Service
 * Lifecycle-aware orchestration:
 * - INVOICE sync when invoice is OPEN
 * - PAYMENT sync when invoice is PAID (against existing Xero invoice)
 */

import { createXeroInvoice } from './invoice-service';
import { recordXeroPayment } from './payment-service';
import { prisma } from '@/lib/server/prisma';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { TokenType } from '@/lib/hedera/types';
import { logger } from '@/lib/logger';
import { formatXeroSyncError } from './xero-sync-errors';
import {
  enrichXeroRequestPayload,
  loadXeroExportContext,
  resolveXeroPostingValues,
} from './xero-layer-export';

export interface SyncPaymentParams {
  paymentLinkId: string;
  organizationId: string;
}

export interface SyncResult {
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  paymentId?: string;
  syncRecordId?: string;
  error?: string;
  narration?: string;
}

async function getLatestConfirmedPaymentEvent(paymentLinkId: string) {
  return prisma.payment_events.findFirst({
    where: { payment_link_id: paymentLinkId, event_type: 'PAYMENT_CONFIRMED' },
    orderBy: { created_at: 'desc' },
  });
}

export function derivePaymentMethod(
  paymentEvent: {
    payment_method: string | null;
    source_type: string | null;
  },
  fallback: string | null
): 'STRIPE' | 'HEDERA' | 'WISE' | 'EVM_WALLET' {
  const candidate = paymentEvent.payment_method || fallback || '';
  if (
    candidate === 'STRIPE' ||
    candidate === 'HEDERA' ||
    candidate === 'WISE' ||
    candidate === 'EVM_WALLET'
  ) {
    return candidate;
  }
  if (candidate === 'MANUAL_BANK' || candidate === 'MANUAL') {
    return 'WISE';
  }
  if (paymentEvent.source_type === 'WISE' || paymentEvent.source_type === 'MANUAL') {
    return 'WISE';
  }
  if (paymentEvent.source_type === 'EVM_WALLET') {
    return 'EVM_WALLET';
  }
  return 'STRIPE';
}

async function upsertSyncStatus(args: {
  paymentLinkId: string;
  syncType: 'INVOICE' | 'PAYMENT';
  organizationId: string;
  status: 'SUCCESS' | 'FAILED';
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  paymentId?: string | null;
  payload?: Prisma.InputJsonValue;
  requestPayload?: Prisma.InputJsonValue;
  errorMessage?: string | null;
}) {
  const {
    paymentLinkId,
    syncType,
    organizationId,
    status,
    invoiceId,
    paymentId,
    payload,
    requestPayload,
    errorMessage,
  } = args;

  const baseRequestPayload = {
    paymentLinkId,
    organizationId,
    syncType,
  };

  await prisma.xero_syncs.upsert({
    where: {
      xero_syncs_payment_link_sync_type_unique: {
        payment_link_id: paymentLinkId,
        sync_type: syncType,
      },
    },
    update: {
      status,
      xero_invoice_id: invoiceId ?? null,
      xero_payment_id: paymentId ?? null,
      response_payload: payload ?? Prisma.JsonNull,
      ...(requestPayload != null ? { request_payload: requestPayload } : {}),
      error_message: errorMessage ?? null,
      next_retry_at: null,
      updated_at: new Date(),
    },
    create: {
      id: randomUUID(),
      payment_link_id: paymentLinkId,
      sync_type: syncType,
      status,
      xero_invoice_id: invoiceId ?? null,
      xero_payment_id: paymentId ?? null,
      request_payload: (requestPayload ?? baseRequestPayload) as Prisma.InputJsonValue,
      response_payload: payload ?? Prisma.JsonNull,
      error_message: errorMessage ?? null,
      retry_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
}

export async function syncInvoiceToXero(params: SyncPaymentParams): Promise<SyncResult> {
  const { paymentLinkId, organizationId } = params;

  try {
    const loaded = await loadXeroExportContext(prisma, {
      paymentLinkId,
      organizationId,
    });
    if (!loaded) {
      throw new Error('Payment link not found');
    }
    const { link: paymentLink, exportContext } = loaded;

    if (paymentLink.status !== 'OPEN' && paymentLink.status !== 'PAID') {
      throw new Error(
        `Invoice sync requires OPEN/PAID status (current: ${paymentLink.status})`
      );
    }

    const posting = exportContext.posting;
    const enrichedRequestPayload = enrichXeroRequestPayload(
      {
        paymentLinkId,
        organizationId,
        syncType: 'INVOICE',
        xeroPostingAmount: posting.amount,
        xeroPostingCurrency: posting.currency,
        usesAccountingLayer: posting.usesAccountingLayer,
      },
      exportContext.layers
    ) as Prisma.InputJsonValue;

    // Idempotency: if we already have an INVOICE success with xero invoice id, reuse it.
    const existingInvoiceSync = await prisma.xero_syncs.findUnique({
      where: {
        xero_syncs_payment_link_sync_type_unique: {
          payment_link_id: paymentLinkId,
          sync_type: 'INVOICE',
        },
      },
      select: {
        id: true,
        status: true,
        xero_invoice_id: true,
        response_payload: true,
      },
    });
    if (existingInvoiceSync?.status === 'SUCCESS' && existingInvoiceSync.xero_invoice_id) {
      const payload = (existingInvoiceSync.response_payload || {}) as Record<string, unknown>;
      return {
        success: true,
        invoiceId: existingInvoiceSync.xero_invoice_id,
        invoiceNumber:
          typeof payload.invoiceNumber === 'string' ? payload.invoiceNumber : undefined,
      };
    }

    const legacyPosting = resolveXeroPostingValues(paymentLink);
    const invoiceResult = await createXeroInvoice({
      paymentLinkId,
      organizationId,
      amount: legacyPosting.amount,
      currency: legacyPosting.currency,
      description: paymentLink.description,
      customerEmail: paymentLink.customer_email || undefined,
      invoiceReference: paymentLink.invoice_reference || undefined,
      exportContext,
    });
    const invoiceId = invoiceResult.invoiceId?.trim();
    const invoiceNumber = invoiceResult.invoiceNumber?.trim();
    if (!invoiceId || !invoiceNumber) {
      const msg = 'Xero createInvoices did not return a usable invoice ID and invoice number';
      logger.error(
        { paymentLinkId, organizationId, invoiceResult },
        msg
      );
      await upsertSyncStatus({
        paymentLinkId,
        syncType: 'INVOICE',
        organizationId,
        status: 'FAILED',
        errorMessage: msg,
        requestPayload: enrichedRequestPayload,
      });
      return { success: false, error: msg };
    }
    await upsertSyncStatus({
      paymentLinkId,
      syncType: 'INVOICE',
      organizationId,
      status: 'SUCCESS',
      invoiceId,
      invoiceNumber,
      requestPayload: enrichedRequestPayload,
      payload: {
        invoice: invoiceResult as unknown as Prisma.InputJsonValue,
        xeroRawInvoicesResponse: (invoiceResult as { xeroRawInvoicesResponse?: unknown })
          .xeroRawInvoicesResponse ?? null,
        paymentLayers: exportContext.metadata,
      } as Prisma.InputJsonValue,
    });
    await prisma.payment_links.updateMany({
      where: {
        id: paymentLinkId,
        xero_invoice_number: null,
      },
      data: {
        xero_invoice_number: invoiceNumber,
        updated_at: new Date(),
      },
    });
    return {
      success: true,
      invoiceId,
      invoiceNumber,
    };
  } catch (error: unknown) {
    const errorMessage = formatXeroSyncError(error);
    await upsertSyncStatus({
      paymentLinkId,
      syncType: 'INVOICE',
      organizationId,
      status: 'FAILED',
      errorMessage,
    });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Record payment in Xero for a PAID invoice against an existing Xero invoice.
 */
export async function syncPaymentToXero(params: SyncPaymentParams): Promise<SyncResult> {
  const { paymentLinkId, organizationId } = params;
  try {
    const loaded = await loadXeroExportContext(prisma, {
      paymentLinkId,
      organizationId,
    });
    if (!loaded) throw new Error('Payment link not found');
    const { link: paymentLink, exportContext } = loaded;

    if (paymentLink.status !== 'PAID') {
      throw new Error(`Payment sync requires PAID status (current: ${paymentLink.status})`);
    }

    const posting = exportContext.posting;
    const enrichedRequestPayload = enrichXeroRequestPayload(
      {
        paymentLinkId,
        organizationId,
        syncType: 'PAYMENT',
        xeroPostingAmount: posting.amount,
        xeroPostingCurrency: posting.currency,
        usesAccountingLayer: posting.usesAccountingLayer,
      },
      exportContext.layers
    ) as Prisma.InputJsonValue;

    const invoiceSync = await prisma.xero_syncs.findUnique({
      where: {
        xero_syncs_payment_link_sync_type_unique: {
          payment_link_id: paymentLinkId,
          sync_type: 'INVOICE',
        },
      },
      select: {
        status: true,
        xero_invoice_id: true,
      },
    });
    if (!invoiceSync?.xero_invoice_id) {
      throw new Error('Xero invoice not found for this payment link. Sync invoice first.');
    }

    const existingPaymentSync = await prisma.xero_syncs.findUnique({
      where: {
        xero_syncs_payment_link_sync_type_unique: {
          payment_link_id: paymentLinkId,
          sync_type: 'PAYMENT',
        },
      },
      select: { status: true, xero_payment_id: true },
    });
    if (existingPaymentSync?.status === 'SUCCESS' && existingPaymentSync.xero_payment_id) {
      return {
        success: true,
        invoiceId: invoiceSync.xero_invoice_id,
        paymentId: existingPaymentSync.xero_payment_id,
      };
    }

    const paymentEvent = await getLatestConfirmedPaymentEvent(paymentLinkId);
    if (!paymentEvent) throw new Error('Payment event not found');
    const paymentMethod = derivePaymentMethod(
      { payment_method: paymentEvent.payment_method, source_type: paymentEvent.source_type },
      paymentLink.payment_method
    );
    const meta = paymentEvent.metadata as Record<string, unknown> | null | undefined;
    const paymentToken = meta
      ? ((meta.token_type ?? meta.tokenType) as TokenType | undefined)
      : undefined;
    const transactionId =
      paymentEvent.stripe_payment_intent_id ||
      paymentEvent.hedera_transaction_id ||
      paymentEvent.wise_transfer_id ||
      paymentEvent.source_reference ||
      paymentEvent.correlation_id ||
      paymentLinkId;

    let fxRate: number | undefined;
    let cryptoAmount: string | undefined;
    if (!posting.usesAccountingLayer) {
      const settlementSnapshots = await prisma.fx_snapshots.findMany({
        where: { payment_link_id: paymentLinkId, snapshot_type: 'SETTLEMENT' },
      });
      if ((paymentMethod === 'HEDERA' || paymentMethod === 'EVM_WALLET') && paymentToken) {
        const fxSnapshot = settlementSnapshots.find((s) => s.token_type === paymentToken);
        if (fxSnapshot) {
          fxRate = fxSnapshot.rate.toNumber();
        }
        if (paymentEvent.amount_received) {
          cryptoAmount = paymentEvent.amount_received.toString();
        }
      }
    } else if (paymentEvent.amount_received) {
      cryptoAmount = paymentEvent.amount_received.toString();
    }

    const legacyPosting = resolveXeroPostingValues(paymentLink);
    const paymentResult = await recordXeroPayment({
      paymentLinkId,
      organizationId,
      invoiceId: invoiceSync.xero_invoice_id,
      amount: legacyPosting.amount,
      currency: legacyPosting.currency,
      paymentDate: paymentEvent.received_at ?? paymentEvent.created_at,
      paymentMethod,
      paymentToken,
      transactionId,
      fxRate,
      cryptoAmount,
      exportContext,
    });

    const paymentId = paymentResult.paymentId?.trim();
    if (!paymentId) {
      const msg = 'Xero createPayment did not return a payment ID';
      logger.error({ paymentLinkId, organizationId, paymentResult }, msg);
      await upsertSyncStatus({
        paymentLinkId,
        syncType: 'PAYMENT',
        organizationId,
        status: 'FAILED',
        errorMessage: msg,
        requestPayload: enrichedRequestPayload,
      });
      return { success: false, error: msg };
    }

    await upsertSyncStatus({
      paymentLinkId,
      syncType: 'PAYMENT',
      organizationId,
      status: 'SUCCESS',
      invoiceId: invoiceSync.xero_invoice_id,
      paymentId,
      requestPayload: enrichedRequestPayload,
      payload: {
        payment: paymentResult as unknown as Prisma.InputJsonValue,
        paymentLayers: exportContext.metadata,
      } as Prisma.InputJsonValue,
    });

    return {
      success: true,
      invoiceId: invoiceSync.xero_invoice_id,
      paymentId,
      narration: paymentResult.narration,
    };
  } catch (error: unknown) {
    const errorMessage = formatXeroSyncError(error);
    await upsertSyncStatus({
      paymentLinkId,
      syncType: 'PAYMENT',
      organizationId,
      status: 'FAILED',
      errorMessage,
    });
    logger.error({ paymentLinkId, organizationId, error: errorMessage }, 'Xero payment sync failed');
    return { success: false, error: errorMessage };
  }
}

/**
 * Retry failed sync
 */
export async function retryFailedSync(syncRecordId: string): Promise<SyncResult> {
  const syncRecord = await prisma.xero_syncs.findUnique({
    where: { id: syncRecordId },
  });

  if (!syncRecord) return { success: false, error: 'Sync record not found' };
  if (syncRecord.status === 'SUCCESS') {
    return { success: false, error: 'Sync already completed successfully' };
  }

  const requestPayload = syncRecord.request_payload as Record<string, unknown>;
  const paymentLinkId = String(requestPayload.paymentLinkId || '');
  const organizationId = String(requestPayload.organizationId || '');
  if (!paymentLinkId || !organizationId) {
    return { success: false, error: 'Invalid sync record: missing required fields' };
  }

  await prisma.xero_syncs.update({
    where: { id: syncRecordId },
    data: {
      retry_count: syncRecord.retry_count + 1,
      status: 'RETRYING',
      updated_at: new Date(),
    },
  });

  return syncRecord.sync_type === 'INVOICE'
    ? syncInvoiceToXero({ paymentLinkId, organizationId })
    : syncPaymentToXero({ paymentLinkId, organizationId });
}

/**
 * Get sync status for a payment link
 */
export async function getSyncStatus(paymentLinkId: string) {
  const syncRecords = await prisma.xero_syncs.findMany({
    where: { payment_link_id: paymentLinkId },
    orderBy: { created_at: 'desc' },
    take: 1,
  });

  return syncRecords[0] || null;
}






