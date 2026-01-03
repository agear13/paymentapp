/**
 * Public API endpoint to fetch merchant settings for a payment link
 * Used by payment page to get merchant's Hedera account ID
 * 
 * Moved from /api/payment-links/[shortCode]/merchant to avoid routing conflict
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  try {
    // Next.js 15: await params
    const { shortCode } = await params;

    log.info({ shortCode }, '[Merchant API] Request received');

    if (!shortCode) {
      log.warn('[Merchant API] Missing shortCode in request');
      return NextResponse.json(
        { error: 'Short code is required' },
        { status: 400 }
      );
    }

    // Find payment link with merchant settings
    log.info({ shortCode }, '[Merchant API] Looking up payment link');
    const paymentLink = await prisma.payment_links.findUnique({
      where: { short_code: shortCode },
      select: {
        id: true,
        status: true,
        organization_id: true,
      },
    });

    if (!paymentLink) {
      log.warn({ shortCode }, '[Merchant API] Payment link not found');
      return NextResponse.json(
        { error: 'Payment link not found' },
        { status: 404 }
      );
    }

    log.info(
      { shortCode, paymentLinkId: paymentLink.id, organizationId: paymentLink.organization_id },
      '[Merchant API] Payment link found, fetching merchant settings'
    );

    // Fetch merchant settings for the organization
    const merchantSettings = await prisma.merchant_settings.findFirst({
      where: { organization_id: paymentLink.organization_id },
      select: {
        hedera_account_id: true,
        display_name: true,
        stripe_account_id: true,
      },
      orderBy: { created_at: 'desc' },
    });

    if (!merchantSettings) {
      log.warn(
        { shortCode, organizationId: paymentLink.organization_id },
        '[Merchant API] Merchant settings not found for organization'
      );
      return NextResponse.json(
        { error: 'Merchant settings not found' },
        { status: 404 }
      );
    }

    log.info(
      {
        shortCode,
        hasHederaAccount: !!merchantSettings.hedera_account_id,
        hasStripeAccount: !!merchantSettings.stripe_account_id,
      },
      '[Merchant API] Merchant settings found, returning data'
    );

    return NextResponse.json({
      data: {
        hederaAccountId: merchantSettings.hedera_account_id,
        displayName: merchantSettings.display_name,
        hasStripeAccount: !!merchantSettings.stripe_account_id,
        hasHederaAccount: !!merchantSettings.hedera_account_id,
      },
    });
  } catch (error) {
    log.error({ error }, '[Merchant API] Failed to fetch merchant settings');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}







