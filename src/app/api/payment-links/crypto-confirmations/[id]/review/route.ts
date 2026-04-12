/**
 * POST /api/payment-links/crypto-confirmations/[id]/review
 * Merchant approves (marks invoice PAID) or rejects (invoice stays OPEN).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { applyRateLimit } from '@/lib/rate-limit';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { CryptoConfirmationReviewSchema } from '@/lib/validations/schemas';
import { confirmPayment } from '@/lib/services/payment-confirmation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;
    const { user } = auth;

    const { id } = await params;
    const body = await request.json();
    const parsed = CryptoConfirmationReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const confirmation = await prisma.crypto_payment_confirmations.findUnique({
      where: { id },
      include: {
        payment_links: true,
      },
    });

    if (!confirmation) {
      return NextResponse.json({ error: 'Confirmation not found' }, { status: 404 });
    }

    const orgId = confirmation.payment_links.organization_id;
    const canEdit = await checkUserPermission(user.id, orgId, 'edit_payment_links');
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (confirmation.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'This confirmation has already been reviewed' },
        { status: 400 }
      );
    }

    const link = confirmation.payment_links;

    if (parsed.data.action === 'reject') {
      await prisma.crypto_payment_confirmations.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewed_at: new Date(),
        },
      });

      loggers.api.info(
        { confirmationId: id, paymentLinkId: link.id, action: 'reject' },
        'Crypto payment confirmation rejected'
      );

      return NextResponse.json({
        message: 'Confirmation rejected. The invoice remains open.',
        data: { id, status: 'REJECTED' },
      });
    }

    if (link.status !== 'OPEN' || link.payment_method !== 'CRYPTO') {
      return NextResponse.json(
        { error: 'Invoice cannot be approved in its current state' },
        { status: 400 }
      );
    }

    const result = await confirmPayment({
      paymentLinkId: link.id,
      provider: 'crypto',
      providerRef: id,
      amountReceived: Number(link.amount),
      currencyReceived: link.currency,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Could not mark invoice paid' },
        { status: 400 }
      );
    }

    loggers.api.info(
      { confirmationId: id, paymentLinkId: link.id, action: 'approve' },
      'Crypto payment confirmation approved'
    );

    return NextResponse.json({
      message: 'Payment confirmed. Invoice marked as paid.',
      data: {
        id,
        status: 'APPROVED',
        paymentLinkId: link.id,
        paymentEventId: result.paymentEventId,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    loggers.api.error({ error: message }, 'crypto confirmation review failed');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
