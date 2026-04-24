/**
 * Payment Link Resend API
 * POST /api/payment-links/[id]/resend - send invoice to an email.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { applyRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import {
  sendInvoiceForPaymentLink,
} from '@/lib/payment-links/send-invoice-service';

const ResendBodySchema = z.object({
  email: z.string().email('Enter a valid client email address.').optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = ResendBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid email' },
        { status: 400 }
      );
    }

    let email = parsed.data.email?.trim() || '';
    if (!email) {
      const link = await prisma.payment_links.findUnique({
        where: { id: params.id },
        select: { last_sent_to_email: true },
      });
      email = link?.last_sent_to_email?.trim() || '';
    }
    if (!email) {
      return NextResponse.json(
        { error: 'No email provided and no previous recipient available' },
        { status: 400 }
      );
    }

    const result = await sendInvoiceForPaymentLink({
      paymentLinkId: params.id,
      userId: user.id,
      email,
      origin: request.nextUrl.origin,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to resend invoice';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
