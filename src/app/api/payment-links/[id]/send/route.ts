import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { applyRateLimit } from '@/lib/rate-limit';
import {
  SendInvoiceBodySchema,
  sendInvoiceForPaymentLink,
} from '@/lib/payment-links/send-invoice-service';

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
    const emailRaw =
      body && typeof body.email === 'string' ? body.email.trim() : '';
    if (!emailRaw) {
      return NextResponse.json(
        { error: 'Client email is required to send invoice' },
        { status: 400 }
      );
    }
    const parsed = SendInvoiceBodySchema.safeParse({ email: emailRaw });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid email' },
        { status: 400 }
      );
    }

    const result = await sendInvoiceForPaymentLink({
      paymentLinkId: params.id,
      userId: user.id,
      email: parsed.data.email,
      origin: request.nextUrl.origin,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Could not send invoice';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

