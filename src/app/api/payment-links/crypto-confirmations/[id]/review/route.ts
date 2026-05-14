/**
 * POST /api/payment-links/crypto-confirmations/[id]/review
 * Optional merchant follow-up: mark_valid → PAID, flag_investigate, acknowledge (no approval gate).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { applyRateLimit } from '@/lib/rate-limit';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { CryptoConfirmationReviewSchema } from '@/lib/validations/schemas';
import { transitionPaymentLinkState } from '@/lib/payments/state-machine';
import { createReferralConversionFromPaymentConfirmed } from '@/lib/referrals/payment-conversion';

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
      include: { payment_links: true },
    });

    if (!confirmation) {
      return NextResponse.json({ error: 'Confirmation not found' }, { status: 404 });
    }

    const orgId = confirmation.payment_links.organization_id;
    const canEdit = await checkUserPermission(user.id, orgId, 'edit_payment_links');
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (confirmation.status !== 'SUBMITTED') {
      return NextResponse.json(
        { error: 'Only submitted confirmations support this action' },
        { status: 400 }
      );
    }

    const link = confirmation.payment_links;

    if (link.payment_method !== 'CRYPTO') {
      return NextResponse.json({ error: 'Not a crypto invoice' }, { status: 400 });
    }

    if (parsed.data.action === 'acknowledge') {
      await prisma.crypto_payment_confirmations.update({
        where: { id },
        data: { merchant_acknowledged_at: new Date() },
      });
      return NextResponse.json({
        message: 'Acknowledged.',
        data: { id, action: 'acknowledge' },
      });
    }

    if (parsed.data.action === 'flag_investigate') {
      await prisma.crypto_payment_confirmations.update({
        where: { id },
        data: {
          merchant_investigation_flag: true,
          reviewed_at: new Date(),
        },
      });

      if (link.status === 'PAID_UNVERIFIED') {
        await prisma.$transaction(async (tx) => {
          await transitionPaymentLinkState({
            tx,
            paymentLinkId: link.id,
            targetState: 'REQUIRES_REVIEW',
            source: 'crypto-review',
            reason: 'merchant_flag_investigate',
            metadata: { confirmationId: id },
          });
        });
      }

      loggers.api.info({ confirmationId: id, paymentLinkId: link.id }, 'Crypto confirmation flagged for investigation');

      return NextResponse.json({
        message: 'Flagged for investigation. Invoice set to requires review if it was unverified paid.',
        data: { id, action: 'flag_investigate' },
      });
    }

    // mark_valid → PAID (optional accounting finalization)
    if (!['PAID_UNVERIFIED', 'REQUIRES_REVIEW'].includes(link.status)) {
      return NextResponse.json(
        { error: 'Invoice is not in a state that can be marked valid (expected paid unverified or requires review).' },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await transitionPaymentLinkState({
        tx,
        paymentLinkId: link.id,
        targetState: 'PAID',
        source: 'crypto-confirmation-review',
        reason: 'merchant_mark_valid',
        metadata: { actorUserId: user.id, confirmationId: id },
      });
    });

    await prisma.crypto_payment_confirmations.update({
      where: { id },
      data: { reviewed_at: new Date(), status: 'APPROVED' },
    });

    const paymentEvent = await prisma.payment_events.findFirst({
      where: { payment_link_id: link.id, event_type: 'PAYMENT_CONFIRMED' },
      orderBy: { created_at: 'desc' },
    });

    if (paymentEvent) {
      try {
        await createReferralConversionFromPaymentConfirmed({
          paymentLinkId: link.id,
          paymentEventId: paymentEvent.id,
          grossAmount: Number(link.amount),
          currency: link.currency,
          provider: 'manual',
        });
      } catch {
        /* non-blocking */
      }
    }

    loggers.api.info({ confirmationId: id, paymentLinkId: link.id }, 'Crypto invoice marked valid (PAID)');

    return NextResponse.json({
      message: 'Invoice marked as paid.',
      data: { id, action: 'mark_valid', paymentLinkId: link.id },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    loggers.api.error({ error: message }, 'crypto confirmation review failed');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
