/**
 * POST /api/agreement-analyzer/email/webhook
 * Resend webhook handler for Agreement Analyzer obligation report emails.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';

import { processAgreementAnalyzerResendWebhook } from '@/lib/agreement-analyzer/email/process-resend-webhook.server';
import config from '@/lib/config/env';
import { loggers } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const secret = config.email.webhookSecret ?? process.env.RESEND_WEBHOOK_SECRET;

    if (secret) {
      const svixId = req.headers.get('svix-id');
      const svixTimestamp = req.headers.get('svix-timestamp');
      const svixSignature = req.headers.get('svix-signature');

      if (!svixId || !svixTimestamp || !svixSignature) {
        return NextResponse.json({ error: 'Missing webhook signature headers' }, { status: 401 });
      }

      try {
        const wh = new Webhook(secret);
        wh.verify(rawBody, {
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': svixSignature,
        });
      } catch {
        loggers.webhook.warn('Agreement analyzer Resend webhook signature verification failed');
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    } else if (config.isProduction) {
      loggers.webhook.error('RESEND_WEBHOOK_SECRET not set in production');
      return NextResponse.json({ error: 'Webhook verifier is not configured' }, { status: 503 });
    }

    let body: Parameters<typeof processAgreementAnalyzerResendWebhook>[0];
    try {
      body = JSON.parse(rawBody) as Parameters<typeof processAgreementAnalyzerResendWebhook>[0];
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const result = await processAgreementAnalyzerResendWebhook(body);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    loggers.webhook.error('Agreement analyzer email webhook failed', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
