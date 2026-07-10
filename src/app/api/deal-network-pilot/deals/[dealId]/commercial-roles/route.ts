import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/server/prisma';
import { dealRowToRecentDeal } from '@/lib/deal-network-demo/pilot-snapshot.server';

const bodySchema = z.object({
  commercialRoles: z.array(z.record(z.string(), z.unknown())),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ dealId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { dealId } = await context.params;
    const body = bodySchema.parse(await request.json());

    const row = await prisma.deal_network_pilot_deals.findUnique({
      where: { id: dealId },
    });
    if (!row || row.user_id !== user.id) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const current = dealRowToRecentDeal(row);
    const next = {
      ...current,
      commercialRoles: body.commercialRoles,
      lastUpdated: new Date().toISOString(),
    };

    const updated = await prisma.deal_network_pilot_deals.update({
      where: { id: dealId },
      data: {
        deal_payload: next as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ deal: dealRowToRecentDeal(updated) });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    console.error('[deal commercial-roles PATCH]', e);
    return NextResponse.json({ error: 'Failed to update budgeted roles' }, { status: 500 });
  }
}
