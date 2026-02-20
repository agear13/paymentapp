/**
 * Public Payment Link API - Fetch by Short Code
 * GET /api/public/pay/[shortCode] - Fetch payment link data (no auth required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { applyRateLimit } from '@/lib/rate-limit';
import { isValidShortCode } from '@/lib/short-code';

/**
 * GET /api/public/pay/[shortCode]
 * Fetch payment link by short code for public access
 * No authentication required
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  try {
    // Rate limiting
    const rateLimitResult = await applyRateLimit(request, 'public');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const { shortCode } = await params;

    // Validate short code format (8 characters, base64url-safe: A-Za-z0-9_-)
    if (!isValidShortCode(shortCode)) {
      // Dev-only logging for rejected short codes
      if (process.env.NODE_ENV !== 'production') {
        loggers.api.warn(
          { 
            pid: process.pid,
            shortCode: shortCode || '(empty)',
            length: shortCode?.length || 0,
            reason: 'Invalid format - expected 8 chars matching [a-zA-Z0-9_-]'
          },
          'Short code validation failed'
        );
      }
      return NextResponse.json(
        { error: 'Invalid short code format', code: 'INVALID_FORMAT' },
        { status: 400 }
      );
    }

    // Find payment link with related data
    const paymentLink = await prisma.payment_links.findUnique({
      where: { short_code: shortCode },
      include: {
        organizations: {
          select: {
            id: true,
            name: true,
          },
        },
        payment_events: {
          orderBy: { created_at: 'desc' },
          take: 5,
        },
        fx_snapshots: {
          where: { snapshot_type: 'CREATION' },
          orderBy: { captured_at: 'desc' },
          take: 1,
        },
      },
    });

    // Payment link not found
    if (!paymentLink) {
      loggers.api.warn({ shortCode }, 'Payment link not found');
      return NextResponse.json(
        { error: 'Payment link not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check if expired
    const isExpired =
      paymentLink.expires_at && new Date(paymentLink.expires_at) < new Date();
    
    // Check status and update if needed
    let currentStatus = paymentLink.status;
    
    if (isExpired && currentStatus === 'OPEN') {
      // Update to EXPIRED status
      const now = new Date();
      await prisma.$transaction([
        prisma.payment_links.update({
          where: { id: paymentLink.id },
          data: { status: 'EXPIRED', updated_at: now },
        }),
        prisma.payment_events.create({
          data: {
            id: randomUUID(),
            payment_link_id: paymentLink.id,
            event_type: 'EXPIRED',
            metadata: { expiredAt: now.toISOString() },
            created_at: now,
          },
        }),
      ]);
      currentStatus = 'EXPIRED';
    }

    // Get merchant settings for payment methods and logo
    const merchantSettings = await prisma.merchant_settings.findFirst({
      where: { organization_id: paymentLink.organization_id },
      select: {
        display_name: true,
        organization_logo_url: true,
        stripe_account_id: true,
        hedera_account_id: true,
        wise_profile_id: true,
      },
    });

    const showWiseDemo = process.env.NEXT_PUBLIC_SHOW_WISE_DEMO !== 'false';
    const wiseEnabled =
      !!merchantSettings?.wise_profile_id ||
      (process.env.ENABLE_WISE_PAYMENTS === 'true' && !!(process.env.WISE_API_TOKEN && process.env.WISE_PROFILE_ID)) ||
      showWiseDemo;

    // Determine available payment methods
    const availablePaymentMethods = {
      stripe: !!merchantSettings?.stripe_account_id,
      hedera: !!merchantSettings?.hedera_account_id,
      wise: wiseEnabled,
    };

    loggers.api.info(
      {
        shortCode,
        paymentLinkId: paymentLink.id,
        status: currentStatus,
      },
      'Public payment link fetched'
    );

    // Return sanitized data (exclude sensitive info)
    return NextResponse.json({
      data: {
        id: paymentLink.id,
        shortCode: paymentLink.short_code,
        status: currentStatus,
        paymentMethod: paymentLink.payment_method,
        amount: paymentLink.amount.toString(),
        currency: paymentLink.currency,
        description: paymentLink.description,
        invoiceReference: paymentLink.invoice_reference,
        customerName: paymentLink.customer_name,
        dueDate: paymentLink.due_date,
        expiresAt: paymentLink.expires_at,
        createdAt: paymentLink.created_at,
        merchant: {
          name: merchantSettings?.display_name || paymentLink.organizations.name,
          logoUrl: merchantSettings?.organization_logo_url || null,
        },
        availablePaymentMethods,
        wiseTransferId: paymentLink.wise_transfer_id ?? null,
        wiseStatus: paymentLink.wise_status ?? null,
        fxSnapshot: paymentLink.fx_snapshots?.[0] || null,
        lastEvent: paymentLink.payment_events?.[0] || null,
      },
    });
  } catch (error: any) {
    const { shortCode } = await params;
    loggers.api.error(
      { error: error.message, shortCode },
      'Failed to fetch public payment link'
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}




