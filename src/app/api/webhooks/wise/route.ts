/**
 * Wise Webhook Endpoint
 * POST /api/webhooks/wise - Handle Wise transfer status events
 * Idempotent: uses transfer_id + event id; confirmPayment checks wise_transfer_id
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';
import { mapWiseStatusToInternal } from '@/lib/wise/status-mapping';
import { confirmPayment } from '@/lib/services/payment-confirmation';
import config from '@/lib/config/env';

/** Wise webhook payload (transfer state change) */
interface WiseWebhookPayload {
  data?: {
    resource?: {
      id?: number;
      profile_id?: number;
      status?: string;
      rate?: number;
      source_amount?: number;
      target_amount?: number;
      source_currency?: string;
      target_currency?: string;
    };
  };
  /** Event id for idempotency */
  delivery_id?: string;
  event_type?: string;
}

/**
 * Optional signature verification. Wise uses X-Signature-SHA256 (RSA).
 * When WISE_WEBHOOK_SECRET is set we require the header; full RSA verification can be added.
 */
function verifyWiseWebhookSignature(body: string, signature: string | null): boolean {
  const secret = config.wise?.webhookSecret ?? process.env.WISE_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signature) return false;
  // Wise uses RSA; for now we only check presence when secret is set.
  // TODO: implement RSA verification with Wise public key when available
  return signature.length > 0;
}

export async function POST(request: NextRequest) {
  const correlationId = `wise_webhook_${Date.now()}`;

  try {
    if (!config.features.wisePayments) {
      log.warn({ correlationId }, 'Wise payments disabled - webhook ignored');
      return NextResponse.json({ received: true, processed: false });
    }

    const body = await request.text();
    const headersList = request.headers;
    const signature = headersList.get('x-signature-sha256') ?? headersList.get('X-Signature-SHA256');

    if (!verifyWiseWebhookSignature(body, signature)) {
      log.warn({ correlationId }, 'Wise webhook signature missing or invalid');
      return NextResponse.json({ error: 'Invalid or missing signature' }, { status: 401 });
    }

    let payload: WiseWebhookPayload;
    try {
      payload = JSON.parse(body) as WiseWebhookPayload;
    } catch {
      log.warn({ correlationId }, 'Wise webhook invalid JSON');
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const resource = payload?.data?.resource;
    const transferId = resource?.id;
    const status = resource?.status;

    if (transferId == null || status == null) {
      log.info(
        { correlationId, eventType: payload?.event_type, hasResource: !!resource },
        'Wise webhook skipped - no transfer id or status'
      );
      return NextResponse.json({ received: true, processed: false });
    }

    const internalStatus = mapWiseStatusToInternal(status);

    const paymentLink = await prisma.payment_links.findFirst({
      where: { wise_transfer_id: String(transferId) },
    });

    if (!paymentLink) {
      log.info(
        { correlationId, transferId, status },
        'Wise webhook: no payment link for transfer (may be non–payment-link transfer)'
      );
      return NextResponse.json({ received: true, processed: false });
    }

    if (internalStatus === 'FAILED') {
      await prisma.payment_events.create({
        data: {
          payment_link_id: paymentLink.id,
          event_type: 'PAYMENT_FAILED',
          payment_method: 'WISE',
          wise_transfer_id: String(transferId),
          correlation_id: payload.delivery_id ?? correlationId,
          metadata: { wiseStatus: status, deliveryId: payload.delivery_id },
        },
      });
      log.info({ correlationId, paymentLinkId: paymentLink.id, transferId, status }, 'Wise payment failed');
      return NextResponse.json({ received: true, processed: true });
    }

    if (internalStatus !== 'PAID') {
      log.info(
        { correlationId, paymentLinkId: paymentLink.id, transferId, status, internalStatus },
        'Wise webhook: status not PAID, skipping confirmation'
      );
      return NextResponse.json({ received: true, processed: false });
    }

    const amountReceived =
      resource.target_amount != null ? Number(resource.target_amount) : Number(paymentLink.amount);
    const currencyReceived = (resource.target_currency ?? paymentLink.currency) as string;

    const result = await confirmPayment({
      paymentLinkId: paymentLink.id,
      provider: 'wise',
      providerRef: payload.delivery_id ?? String(transferId),
      transactionId: String(transferId),
      amountReceived: typeof amountReceived === 'number' ? amountReceived : Number(paymentLink.amount),
      currencyReceived: currencyReceived ?? paymentLink.currency,
      correlationId: payload.delivery_id ?? correlationId,
      metadata: {
        wiseStatus: status,
        wiseTransferId: transferId,
        deliveryId: payload.delivery_id,
        rate: resource.rate,
        sourceCurrency: resource.source_currency,
        targetCurrency: resource.target_currency,
      },
    });

    if (!result.success) {
      log.error({ correlationId, paymentLinkId: paymentLink.id, error: result.error }, 'Wise confirmPayment failed');
      return NextResponse.json({ error: result.error ?? 'Confirmation failed' }, { status: 500 });
    }

    log.info(
      {
        correlationId,
        paymentLinkId: paymentLink.id,
        transferId,
        paymentEventId: result.paymentEventId,
        alreadyProcessed: result.alreadyProcessed,
      },
      'Wise payment confirmed'
    );
    return NextResponse.json({ received: true, processed: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.error({ correlationId, error: message }, 'Wise webhook failed');
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
