/**
 * POST /api/payment-links/[id]/archive
 * Archive locally (cancel) without changing accounting records.
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/middleware';
import { applyRateLimit } from '@/lib/rate-limit';
import { loggers } from '@/lib/logger';
import { archiveAccountingLinkedInvoice } from '@/lib/accounting/accounting-invoice-removal.server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await archiveAccountingLinkedInvoice({
      userId: user.id,
      paymentLinkId: params.id,
    });

    revalidatePath('/dashboard/payment-links');
    revalidatePath('/workspace/receivables/invoices');

    return NextResponse.json(result);
  } catch (error: unknown) {
    const err = error as Error & { status?: number; code?: string };
    loggers.api.error({ paymentLinkId: params.id, error: err.message }, 'Invoice archive failed');
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.status ?? 500 }
    );
  }
}
