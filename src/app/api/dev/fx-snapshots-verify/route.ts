/**
 * Dev-only: FX snapshots verification for a payment link
 * GET /api/dev/fx-snapshots-verify?paymentLinkId=...
 * Returns count of CREATION snapshots, SETTLEMENT snapshots, and token_types present.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';

const DEV_ONLY = process.env.NODE_ENV !== 'production';

export async function GET(request: NextRequest) {
  if (!DEV_ONLY) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const paymentLinkId = request.nextUrl.searchParams.get('paymentLinkId');
  if (!paymentLinkId) {
    return NextResponse.json(
      { error: 'paymentLinkId query parameter is required' },
      { status: 400 }
    );
  }

  try {
    const snapshots = await prisma.fx_snapshots.findMany({
      where: { payment_link_id: paymentLinkId },
      orderBy: { captured_at: 'asc' },
      select: {
        id: true,
        snapshot_type: true,
        token_type: true,
        base_currency: true,
        quote_currency: true,
        rate: true,
        provider: true,
        captured_at: true,
      },
    });

    const creation = snapshots.filter((s) => s.snapshot_type === 'CREATION');
    const settlement = snapshots.filter((s) => s.snapshot_type === 'SETTLEMENT');
    const tokenTypes = [...new Set(snapshots.map((s) => s.token_type).filter(Boolean))] as string[];

    return NextResponse.json({
      paymentLinkId,
      creationCount: creation.length,
      settlementCount: settlement.length,
      tokenTypes,
      snapshots: snapshots.map((s) => ({
        id: s.id,
        snapshot_type: s.snapshot_type,
        token_type: s.token_type,
        base_currency: s.base_currency,
        quote_currency: s.quote_currency,
        rate: Number(s.rate),
        provider: s.provider,
        captured_at: s.captured_at,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
