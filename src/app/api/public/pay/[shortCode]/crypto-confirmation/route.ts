/**
 * POST /api/public/pay/[shortCode]/crypto-confirmation
 * Payer submits "I've sent payment" details (pending until merchant approves).
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { applyRateLimit } from '@/lib/rate-limit';
import { isValidShortCode } from '@/lib/short-code';
import { PublicCryptoConfirmationSubmitSchema } from '@/lib/validations/schemas';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'public');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { shortCode } = await params;
    if (!isValidShortCode(shortCode)) {
      return NextResponse.json({ error: 'Invalid short code format', code: 'INVALID_FORMAT' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = PublicCryptoConfirmationSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { payerNetwork, payerAmountSent, payerWalletAddress, payerTxHash } = parsed.data;

    const paymentLink = await prisma.payment_links.findUnique({
      where: { short_code: shortCode },
    });

    if (!paymentLink) {
      return NextResponse.json({ error: 'Payment link not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    if (paymentLink.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'This invoice is not open for payment', code: 'NOT_OPEN' },
        { status: 400 }
      );
    }

    if (paymentLink.invoice_only_mode || paymentLink.payment_method !== 'CRYPTO') {
      return NextResponse.json(
        { error: 'Crypto payment confirmation is not available for this link', code: 'INVALID_METHOD' },
        { status: 400 }
      );
    }

    const id = randomUUID();
    const row = await prisma.crypto_payment_confirmations.create({
      data: {
        id,
        payment_link_id: paymentLink.id,
        status: 'PENDING',
        payer_network: payerNetwork.trim(),
        payer_amount_sent: payerAmountSent.trim(),
        payer_wallet_address: payerWalletAddress.trim(),
        payer_tx_hash: payerTxHash?.trim() || null,
      },
    });

    loggers.api.info(
      { shortCode, paymentLinkId: paymentLink.id, confirmationId: row.id },
      'Public crypto payment confirmation submitted'
    );

    return NextResponse.json({
      data: {
        id: row.id,
        status: row.status,
        createdAt: row.created_at,
      },
      message: 'Payment confirmation submitted. The merchant will review and mark the invoice paid when verified.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    loggers.api.error({ error: message }, 'crypto-confirmation POST failed');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
