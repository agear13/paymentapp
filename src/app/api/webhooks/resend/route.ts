import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { prisma } from '@/lib/server/prisma';
import config from '@/lib/config/env';
import { log } from '@/lib/logger';

/**
 * POST /api/webhooks/resend
 *
 * Webhook handler for Resend email events (signed with Svix when RESEND_WEBHOOK_SECRET is set).
 *
 * Events:
 * - email.sent, email.delivered, email.opened, email.clicked, email.bounced, email.complained
 */
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
        log.warn({}, 'Resend webhook signature verification failed');
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    } else if (config.isProduction) {
      log.error({}, 'RESEND_WEBHOOK_SECRET not set in production');
      return NextResponse.json(
        { error: 'Webhook verifier is not configured' },
        { status: 503 }
      );
    }

    let body: { type?: string; data?: { email_id?: string; bounce?: { message?: string } } };
    try {
      body = JSON.parse(rawBody) as typeof body;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { type, data } = body;
    if (!data?.email_id) {
      return NextResponse.json({ received: true, processed: false });
    }

    log.info({ type, emailId: data.email_id }, 'Resend webhook event');

    const emailLog = await prisma.email_logs.findFirst({
      where: {
        provider_id: data.email_id,
      },
    });

    if (!emailLog) {
      log.warn({ emailId: data.email_id }, 'Resend webhook: email log not found');
      return NextResponse.json({ received: true });
    }

    switch (type) {
      case 'email.sent':
        await prisma.email_logs.update({
          where: { id: emailLog.id },
          data: {
            status: 'SENT',
            provider_response: data as object,
          },
        });
        break;

      case 'email.delivered':
        await prisma.email_logs.update({
          where: { id: emailLog.id },
          data: {
            status: 'DELIVERED',
            provider_response: data as object,
          },
        });
        break;

      case 'email.opened':
        await prisma.email_logs.update({
          where: { id: emailLog.id },
          data: {
            status: 'OPENED',
            opened_at: new Date(),
            provider_response: data as object,
          },
        });
        break;

      case 'email.clicked':
        await prisma.email_logs.update({
          where: { id: emailLog.id },
          data: {
            status: 'CLICKED',
            clicked_at: new Date(),
            provider_response: data as object,
          },
        });
        break;

      case 'email.bounced':
        await prisma.email_logs.update({
          where: { id: emailLog.id },
          data: {
            status: 'BOUNCED',
            bounced_at: new Date(),
            error_message: data.bounce?.message || 'Email bounced',
            provider_response: data as object,
          },
        });
        break;

      case 'email.complained':
        await prisma.email_logs.update({
          where: { id: emailLog.id },
          data: {
            status: 'FAILED',
            error_message: 'Marked as spam',
            provider_response: data as object,
          },
        });
        break;

      default:
        log.info({ type }, 'Resend webhook: unknown event type');
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error({ error: message }, 'Resend webhook error');
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
