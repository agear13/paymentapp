import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { listInvoicesAttachedToWorkspace } from '@/lib/commercial-os/attached-invoices.server';

export const dynamic = 'force-dynamic';

/** GET — payment_links already bound to this pilot deal. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ dealId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { dealId } = await context.params;
    const data = await listInvoicesAttachedToWorkspace(user.id, dealId);
    return NextResponse.json({ data });
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const message = err.message || 'Failed to load attached invoices';
    if (message.includes('not found') || message.includes('access denied')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error('[deal-network-pilot/invoices GET]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
