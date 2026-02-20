/**
 * Wise payment setup for a payment link (public, no auth).
 * POST: create quote + transfer, store on link, return payer instructions.
 * GET: return payer instructions if transfer already exists.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { createQuote, createTransfer, getPayerInstructions } from '@/lib/wise/client';
import config from '@/lib/config/env';
import { applyRateLimit } from '@/lib/rate-limit';
import { isValidShortCode } from '@/lib/short-code';

function getProfileId(organizationId: string): string | null {
  if (!config.features.wisePayments) return null;
  const profileId = config.wise?.profileId ?? process.env.WISE_PROFILE_ID;
  if (profileId) return profileId;
  return null;
}

/**
 * GET – return payer instructions if this link already has a Wise transfer
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, 'public');
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { shortCode } = await params;
  if (!isValidShortCode(shortCode)) {
    return NextResponse.json({ error: 'Invalid short code' }, { status: 400 });
  }

  const paymentLink = await prisma.payment_links.findUnique({
    where: { short_code: shortCode },
  });

  if (!paymentLink || !paymentLink.wise_transfer_id) {
    return NextResponse.json(
      { error: 'No Wise transfer for this link', instructions: null },
      { status: 200 }
    );
  }

  const profileId =
    getProfileId(paymentLink.organization_id) ??
    (await prisma.merchant_settings.findFirst({
      where: { organization_id: paymentLink.organization_id },
      select: { wise_profile_id: true },
    }))?.wise_profile_id;

  if (!profileId) {
    return NextResponse.json({
      instructions: {
        type: 'bank_transfer',
        reference: paymentLink.wise_transfer_id,
        transferId: paymentLink.wise_transfer_id,
        message: 'Use the reference above when making your bank transfer.',
      },
    });
  }

  try {
    const instructions = await getPayerInstructions(
      profileId,
      Number(paymentLink.wise_transfer_id)
    );
    return NextResponse.json({
      instructions: instructions ?? {
        type: 'bank_transfer',
        reference: paymentLink.wise_transfer_id,
        transferId: paymentLink.wise_transfer_id,
      },
    });
  } catch (e) {
    loggers.api.warn({ shortCode, error: (e as Error).message }, 'Wise get instructions failed');
    return NextResponse.json({
      instructions: {
        type: 'bank_transfer',
        reference: paymentLink.wise_transfer_id,
        transferId: paymentLink.wise_transfer_id,
      },
    });
  }
}

/**
 * POST – create Wise quote + transfer, update link, return payer instructions
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, 'public');
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { shortCode } = await params;
  if (!isValidShortCode(shortCode)) {
    return NextResponse.json({ error: 'Invalid short code' }, { status: 400 });
  }

  const paymentLink = await prisma.payment_links.findUnique({
    where: { short_code: shortCode },
  });

  if (!paymentLink) {
    return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
  }

  if (paymentLink.status !== 'OPEN') {
    return NextResponse.json({ error: 'Link is not open for payment' }, { status: 400 });
  }

  const profileId =
    getProfileId(paymentLink.organization_id) ??
    (await prisma.merchant_settings.findFirst({
      where: { organization_id: paymentLink.organization_id },
      select: { wise_profile_id: true },
    }))?.wise_profile_id ??
    config.wise?.profileId ??
    process.env.WISE_PROFILE_ID;

  if (!profileId) {
    return NextResponse.json(
      { error: 'Wise is not configured for this merchant' },
      { status: 400 }
    );
  }

  if (paymentLink.wise_transfer_id) {
    try {
      const instructions = await getPayerInstructions(
        profileId,
        Number(paymentLink.wise_transfer_id)
      );
      return NextResponse.json({
        transferId: paymentLink.wise_transfer_id,
        quoteId: paymentLink.wise_quote_id,
        instructions: instructions ?? {
          type: 'bank_transfer',
          reference: paymentLink.wise_transfer_id,
          transferId: paymentLink.wise_transfer_id,
        },
      });
    } catch {
      // fall through to create again if fetch failed
    }
  }

  try {
    const amount = Number(paymentLink.amount);
    const currency = paymentLink.currency;

    const quote = await createQuote({
      profileId,
      sourceCurrency: currency,
      targetCurrency: currency,
      targetAmount: amount,
    });

    const transfer = await createTransfer(profileId, {
      quoteId: quote.id,
      customerTransactionId: paymentLink.id,
      details: {
        reference: `PAY-${paymentLink.short_code}`,
        transferPurpose: paymentLink.description?.slice(0, 200),
      },
    });

    await prisma.payment_links.update({
      where: { id: paymentLink.id },
      data: {
        wise_quote_id: String(quote.id),
        wise_transfer_id: String(transfer.id),
        wise_status: transfer.status,
        updated_at: new Date(),
      },
    });

    const instructions = await getPayerInstructions(profileId, transfer.id);

    loggers.api.info(
      {
        paymentLinkId: paymentLink.id,
        shortCode,
        wiseTransferId: transfer.id,
        wiseQuoteId: quote.id,
      },
      'Wise transfer created for payment link'
    );

    return NextResponse.json({
      transferId: String(transfer.id),
      quoteId: String(quote.id),
      status: transfer.status,
      instructions: instructions ?? {
        type: 'bank_transfer',
        reference: `PAY-${paymentLink.short_code}`,
        transferId: String(transfer.id),
        accountHolderName: 'Merchant',
        currency: transfer.targetCurrency ?? currency,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Wise setup failed';
    loggers.api.error({ shortCode, error: message }, 'Wise create transfer failed');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
