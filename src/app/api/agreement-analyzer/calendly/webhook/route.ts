/**
 * POST /api/agreement-analyzer/calendly/webhook
 * Calendly webhook handler for attributed demo bookings.
 */

import { NextRequest, NextResponse } from 'next/server';

import { verifyCalendlyWebhookSignature } from '@/lib/agreement-analyzer/calendly/calendly-webhook-signature.server';
import type { CalendlyWebhookBody } from '@/lib/agreement-analyzer/calendly/calendly-webhook-types';
import { processAgreementAnalyzerCalendlyWebhook } from '@/lib/agreement-analyzer/calendly/process-calendly-webhook.server';
import config from '@/lib/config/env';
import { loggers } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signingKey = config.agreementAnalyzer.calendlyWebhookSigningKey;

    if (signingKey) {
      const signatureHeader = req.headers.get('calendly-webhook-signature');
      const isValid = verifyCalendlyWebhookSignature({
        rawBody,
        signatureHeader,
        signingKey,
      });

      if (!isValid) {
        loggers.webhook.warn('Agreement analyzer Calendly webhook signature verification failed');
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    } else if (config.isProduction) {
      loggers.webhook.error('CALENDLY_WEBHOOK_SIGNING_KEY not set in production');
      return NextResponse.json({ error: 'Webhook verifier is not configured' }, { status: 503 });
    }

    let body: CalendlyWebhookBody;
    try {
      body = JSON.parse(rawBody) as CalendlyWebhookBody;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const result = await processAgreementAnalyzerCalendlyWebhook(body);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    loggers.webhook.error('Agreement analyzer Calendly webhook failed', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
