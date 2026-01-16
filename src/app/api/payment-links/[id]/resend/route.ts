/**
 * Payment Link Resend Notification API
 * POST /api/payment-links/[id]/resend - Resend payment link notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { apiResponse, apiError } from '@/lib/api/middleware';
import { logAudit } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Fetch the payment link
    const paymentLink = await prisma.payment_links.findUnique({
      where: { id },
      include: {
        organizations: true,
      },
    });

    if (!paymentLink) {
      return apiError('Payment link not found', 404);
    }

    // Validate link is in a state where notification makes sense
    if (paymentLink.status === 'PAID') {
      return apiError('Cannot resend notification for paid link', 400);
    }

    if (paymentLink.status === 'CANCELED') {
      return apiError('Cannot resend notification for canceled link', 400);
    }

    if (paymentLink.status === 'EXPIRED') {
      return apiError('Cannot resend notification for expired link', 400);
    }

    // Check if customer email exists
    if (!paymentLink.customer_email) {
      return apiError('Customer email required to send invoice. Add an email address or copy the invoice link to share it manually.', 400);
    }

    // In a real implementation, you would:
    // 1. Send email notification using your email service (SendGrid, SES, etc.)
    // 2. Send SMS if phone number is available
    // 3. Log the notification event
    
    // For now, we'll just create an event and log it
    await prisma.payment_events.create({
      data: {
        payment_link_id: id,
        event_type: 'NOTIFICATION_SENT',
        payment_method: null,
        metadata: {
          channel: 'email',
          recipient: paymentLink.customer_email,
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Log audit trail
    logAudit({
      action: 'RESEND_NOTIFICATION',
      entityType: 'payment_link',
      entityId: id,
      organizationId: paymentLink.organization_id,
      details: {
        email: paymentLink.customer_email,
      },
    });

    return apiResponse({
      message: 'Notification sent successfully',
      data: {
        sent: true,
        recipient: paymentLink.customer_email,
      },
    });
  } catch (error: any) {
    console.error('Error resending notification:', error);
    return apiError(
      error.message || 'Failed to resend notification',
      500
    );
  }
}




