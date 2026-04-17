import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/server/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/deal-network-pilot/obligations?dealId=optional
 * Lists derived obligation rows for the authenticated pilot user (read-only).
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const dealId = searchParams.get('dealId')?.trim();

    const rows = await prisma.deal_network_pilot_obligations.findMany({
      where: {
        user_id: user.id,
        ...(dealId ? { deal_id: dealId } : {}),
      },
      orderBy: [{ deal_id: 'asc' }, { created_at: 'asc' }],
    });

    return NextResponse.json({ data: rows });
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[deal-network-pilot/obligations GET]', e);
    return NextResponse.json({ error: 'Failed to load obligations' }, { status: 500 });
  }
}
