/**
 * POST /api/public/pay/[shortCode]/manual-bank-confirmation
 * Payer submits manual bank transfer details (send-first, verify-after model).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { applyRateLimit } from '@/lib/rate-limit';
import { isValidShortCode } from '@/lib/short-code';
import { PublicManualBankConfirmationSubmitSchema } from '@/lib/validations/schemas';
import { submitManualBankPaymentConfirmation } from '@/lib/payments/manual-bank-submission-service';

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
    const parsed = PublicManualBankConfirmationSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

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
    if (paymentLink.invoice_only_mode || paymentLink.payment_method !== 'MANUAL_BANK') {
      return NextResponse.json(
        { error: 'Manual bank confirmation is not available for this link', code: 'INVALID_METHOD' },
        { status: 400 }
      );
    }

    const result = await submitManualBankPaymentConfirmation({
      paymentLinkId: paymentLink.id,
      shortCode,
      payerAmountSent: parsed.data.payerAmountSent,
      payerCurrency: parsed.data.payerCurrency,
      payerDestination: parsed.data.payerDestination,
      payerPaymentMethodUsed: parsed.data.payerPaymentMethodUsed,
      payerReference: parsed.data.payerReference,
      payerProofDetails: parsed.data.payerProofDetails,
      payerNote: parsed.data.payerNote,
    });

    loggers.api.info(
      { shortCode, paymentLinkId: paymentLink.id, confirmationId: result.confirmationId },
      'Public manual bank confirmation recorded'
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
    loggers.api.error({ error: message }, 'manual-bank-confirmation POST failed');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

