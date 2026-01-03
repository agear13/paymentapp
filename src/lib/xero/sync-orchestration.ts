/**
 * Xero Sync Orchestration Service
 * Orchestrates full sync: create invoice + record payment
 * Handles all payment methods: STRIPE, HBAR, USDC, USDT, AUDD
 */

import { createXeroInvoice } from './invoice-service';
import { recordXeroPayment } from './payment-service';
import { prisma } from '@/lib/server/prisma';
import { randomUUID } from 'crypto';
import type { TokenType } from '@/lib/hedera/types';

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

/**
 * Orchestrate full sync: create invoice + record payment
 * Works for all payment methods: Stripe and all 4 crypto tokens
 */
export async function syncPaymentToXero(
  params: SyncPaymentParams
): Promise<SyncResult> {
  const { paymentLinkId, organizationId } = params;

  try {
    // Get payment link with all related data
    const paymentLink = await prisma.payment_links.findUnique({
      where: { id: paymentLinkId },
      include: {
        payment_events: {
          where: { event_type: 'PAYMENT_CONFIRMED' },
          orderBy: { created_at: 'desc' },
          take: 1,
        },
        fx_snapshots: {
          where: { snapshot_type: 'SETTLEMENT' },
        },
      },
    });

    if (!paymentLink) {
      throw new Error('Payment link not found');
    }

    if (paymentLink.status !== 'PAID') {
      throw new Error(`Payment link is not paid (status: ${paymentLink.status})`);
    }

    const paymentEvent = paymentLink.payment_events[0];
    if (!paymentEvent) {
      throw new Error('Payment event not found');
    }

    // Extract payment method and token
    const paymentMethod = paymentEvent.payment_method as 'STRIPE' | 'HEDERA';
    const paymentToken = paymentEvent.metadata
      ? (paymentEvent.metadata as any).paymentToken as TokenType | undefined
      : undefined;

    // Get transaction ID
    const transactionId =
      paymentEvent.stripe_payment_intent_id ||
      paymentEvent.hedera_transaction_id ||
      '';

    if (!transactionId) {
      throw new Error('Transaction ID not found in payment event');
    }

    console.log('Starting Xero sync:', {
      paymentLinkId,
      paymentMethod,
      paymentToken,
      amount: paymentLink.amount.toString(),
      currency: paymentLink.currency,
    });

    // Step 1: Create invoice in Xero
    console.log('Creating Xero invoice...');
    const invoiceResult = await createXeroInvoice({
      paymentLinkId,
      organizationId,
      amount: paymentLink.amount.toString(),
      currency: paymentLink.currency,
      description: paymentLink.description,
      customerEmail: paymentLink.customer_email || undefined,
      invoiceReference: paymentLink.invoice_reference || undefined,
    });

    console.log('Invoice created:', {
      invoiceId: invoiceResult.invoiceId,
      invoiceNumber: invoiceResult.invoiceNumber,
    });

    // Step 2: Record payment in Xero
    console.log('Recording payment in Xero...');

    // Get FX snapshot for crypto payments
    let fxRate: number | undefined;
    let cryptoAmount: string | undefined;

    if (paymentMethod === 'HEDERA' && paymentToken) {
      const fxSnapshot = paymentLink.fx_snapshots.find(
        (s) => s.token_type === paymentToken && s.snapshot_type === 'SETTLEMENT'
      );

      if (fxSnapshot) {
        fxRate = fxSnapshot.rate.toNumber();
      }

      if (paymentEvent.amount_received) {
        cryptoAmount = paymentEvent.amount_received.toString();
      }
    }

    const paymentResult = await recordXeroPayment({
      paymentLinkId,
      organizationId,
      invoiceId: invoiceResult.invoiceId,
      amount: paymentLink.amount.toString(),
      currency: paymentLink.currency,
      paymentDate: paymentEvent.created_at,
      paymentMethod,
      paymentToken,
      transactionId,
      fxRate,
      cryptoAmount,
    });

    console.log('Payment recorded:', {
      paymentId: paymentResult.paymentId,
      paymentMethod,
      paymentToken,
    });

    // Step 3: Create sync record in database
    const syncRecord = await prisma.xero_syncs.create({
      data: {
        id: randomUUID(),
        payment_link_id: paymentLinkId,
        sync_type: 'INVOICE',
        status: 'SUCCESS',
        xero_invoice_id: invoiceResult.invoiceId,
        xero_payment_id: paymentResult.paymentId,
        request_payload: {
          paymentLinkId,
          organizationId,
          paymentMethod,
          paymentToken,
          transactionId,
        },
        response_payload: {
          invoice: invoiceResult,
          payment: paymentResult,
        },
        retry_count: 0,
        updated_at: new Date(),
      },
    });

    console.log('Xero sync complete:', {
      syncRecordId: syncRecord.id,
      invoiceNumber: invoiceResult.invoiceNumber,
    });

    return {
      success: true,
      invoiceId: invoiceResult.invoiceId,
      invoiceNumber: invoiceResult.invoiceNumber,
      paymentId: paymentResult.paymentId,
      syncRecordId: syncRecord.id,
      narration: paymentResult.narration,
    };
  } catch (error) {
    console.error('Xero sync failed:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log failure in database
    try {
      await prisma.xero_syncs.create({
        data: {
          id: randomUUID(),
          payment_link_id: paymentLinkId,
          sync_type: 'INVOICE',
          status: 'FAILED',
          request_payload: {
            paymentLinkId,
            organizationId,
          },
          error_message: errorMessage,
          retry_count: 0,
          updated_at: new Date(),
        },
      });
    } catch (dbError) {
      console.error('Failed to log sync failure:', dbError);
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Retry failed sync
 */
export async function retryFailedSync(syncRecordId: string): Promise<SyncResult> {
  // Get sync record
  const syncRecord = await prisma.xero_syncs.findUnique({
    where: { id: syncRecordId },
  });

  if (!syncRecord) {
    return {
      success: false,
      error: 'Sync record not found',
    };
  }

  if (syncRecord.status === 'SUCCESS') {
    return {
      success: false,
      error: 'Sync already completed successfully',
    };
  }

  // Extract payment link ID and organization ID from request payload
  const requestPayload = syncRecord.request_payload as any;
  const paymentLinkId = requestPayload.paymentLinkId;
  const organizationId = requestPayload.organizationId;

  if (!paymentLinkId || !organizationId) {
    return {
      success: false,
      error: 'Invalid sync record: missing required fields',
    };
  }

  // Update retry count
  await prisma.xero_syncs.update({
    where: { id: syncRecordId },
    data: {
      retry_count: syncRecord.retry_count + 1,
      status: 'RETRYING',
      updated_at: new Date(),
    },
  });

  // Retry the sync
  return syncPaymentToXero({ paymentLinkId, organizationId });
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






