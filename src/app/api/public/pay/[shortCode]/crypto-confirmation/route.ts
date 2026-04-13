/**
 * POST /api/public/pay/[shortCode]/crypto-confirmation
 * Payer submits payment — invoice becomes PAID_UNVERIFIED or REQUIRES_REVIEW (assisted verification; no merchant approval).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { applyRateLimit } from '@/lib/rate-limit';
import { isValidShortCode } from '@/lib/short-code';
import { PublicCryptoConfirmationSubmitSchema } from '@/lib/validations/schemas';
import { submitCryptoPaymentConfirmation } from '@/lib/payments/crypto-submission-service';

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

    const { payerNetwork, payerAmountSent, payerWalletAddress, payerTxHash, payerCurrency } = parsed.data;

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

    const result = await submitCryptoPaymentConfirmation({
      paymentLinkId: paymentLink.id,
      shortCode,
      payerNetwork,
      payerAmountSent,
      payerWalletAddress,
      payerTxHash,
      payerCurrency,
    });

    loggers.api.info(
      { shortCode, paymentLinkId: paymentLink.id, confirmationId: result.confirmationId },
      'Public crypto payment confirmation recorded'
    );

    return NextResponse.json({
      data: {
        id: result.confirmationId,
        paymentLinkStatus: result.paymentLinkStatus,
        verificationStatus: result.verification_status,
        matchConfidence: result.match_confidence,
        verificationIssues: result.verification_issues,
      },
      message: 'Payment submitted successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    loggers.api.error({ error: message }, 'crypto-confirmation POST failed');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
