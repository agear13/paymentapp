import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/webhooks/resend
 * 
 * Webhook handler for Resend email events
 * 
 * Events:
 * - email.sent - Email was accepted by mail server
 * - email.delivered - Email was delivered to recipient
 * - email.opened - Email was opened by recipient
 * - email.clicked - Link in email was clicked
 * - email.bounced - Email bounced
 * - email.complained - Email was marked as spam
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data } = body;

    console.log('[Resend Webhook] Event:', type, data);

    // Find email log by provider ID
    const emailLog = await prisma.email_logs.findFirst({
      where: {
        provider_id: data.email_id,
      },
    });

    if (!emailLog) {
      console.warn('[Resend Webhook] Email log not found:', data.email_id);
      return NextResponse.json({ received: true });
    }

    // Update email log based on event type
    switch (type) {
      case 'email.sent':
        await prisma.email_logs.update({
          where: { id: emailLog.id },
          data: {
            status: 'SENT',
            provider_response: data,
          },
        });
        break;

      case 'email.delivered':
        await prisma.email_logs.update({
          where: { id: emailLog.id },
          data: {
            status: 'DELIVERED',
            provider_response: data,
          },
        });
        break;

      case 'email.opened':
        await prisma.email_logs.update({
          where: { id: emailLog.id },
          data: {
            status: 'OPENED',
            opened_at: new Date(),
            provider_response: data,
          },
        });
        break;

      case 'email.clicked':
        await prisma.email_logs.update({
          where: { id: emailLog.id },
          data: {
            status: 'CLICKED',
            clicked_at: new Date(),
            provider_response: data,
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
            provider_response: data,
          },
        });
        break;

      case 'email.complained':
        await prisma.email_logs.update({
          where: { id: emailLog.id },
          data: {
            status: 'FAILED',
            error_message: 'Marked as spam',
            provider_response: data,
          },
        });
        break;

      default:
        console.log('[Resend Webhook] Unknown event type:', type);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Resend Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}







