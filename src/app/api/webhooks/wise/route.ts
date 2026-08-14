/**
 * Wise Webhook Endpoint
 * POST /api/webhooks/wise — account-details pay-ins, SWIFT credits, transfer state changes.
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { log } from '@/lib/logger';
import config from '@/lib/config/env';
import type { WiseWebhookPayload } from '@/lib/wise/wise-incoming-payment-correlation';
import { processWiseWebhookPayload } from '@/lib/wise/wise-webhook-processor.server';

function verifyWiseWebhookSignature(body: string, signature: string | null): boolean {
  const secret = config.wise?.webhookSecret ?? process.env.WISE_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signature) return false;

  const normalized = signature.trim().toLowerCase();
  const signatureValue = normalized.includes('=') ? normalized.split('=').pop() ?? '' : normalized;
  if (!signatureValue) return false;

  const expected = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  const provided = Buffer.from(signatureValue, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (provided.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(provided, expectedBuffer);
}

export async function POST(request: NextRequest) {
  const correlationId = `wise_webhook_${Date.now()}`;

  try {
    if (!config.features.wisePayments) {
      log.warn({ correlationId }, 'Wise payments disabled - webhook ignored');
      return NextResponse.json({ received: true, processed: false });
    }

    const body = await request.text();
    const signature =
      request.headers.get('x-signature-sha256') ?? request.headers.get('X-Signature-SHA256');

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

    const result = await processWiseWebhookPayload(payload, correlationId);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.error({ correlationId, error: message }, 'Wise webhook failed');
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
