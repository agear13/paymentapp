/**
 * GET /api/payment-links/[id]/lifecycle
 * Payment lifecycle timeline, health, settlements, and FX lock snapshot.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { AuthError } from '@/lib/auth/errors';
import { checkUserPermission } from '@/lib/auth/permissions';
import { prisma } from '@/lib/server/prisma';
import { getPaymentLifecycleSnapshot } from '@/lib/payments/payment-lifecycle';
import { syncLifecycleFromExistingSources } from '@/lib/payments/lifecycle/lifecycle-sync';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const link = await prisma.payment_links.findUnique({
      where: { id },
      select: { organization_id: true },
    });

    if (!link) {
      return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
    }

    const hasPermission = await checkUserPermission(
      user.id,
      link.organization_id,
      'view_payment_links'
    );
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const backfill = request.nextUrl.searchParams.get('backfill') !== 'false';
    if (backfill) {
      await syncLifecycleFromExistingSources(id);
    }

    const snapshot = await getPaymentLifecycleSnapshot(id);
    if (!snapshot) {
      return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
    }

    return NextResponse.json({ data: snapshot });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load payment lifecycle', details: message },
      { status: 500 }
    );
  }
}
