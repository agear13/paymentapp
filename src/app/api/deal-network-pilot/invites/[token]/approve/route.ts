import { NextResponse } from 'next/server';
import { approveParticipantByInviteToken } from '@/lib/deal-network-demo/pilot-snapshot.server';
import { refreshDealNetworkPilotObligationsForUser } from '@/lib/deal-network-demo/deal-network-pilot-obligations';
import { prisma } from '@/lib/server/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token: raw } = await context.params;
  const token = decodeURIComponent(raw ?? '');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  let note: string | undefined;
  try {
    const body = (await request.json()) as { note?: string };
    note = body.note;
  } catch {
    note = undefined;
  }

  try {
    const result = await approveParticipantByInviteToken(token, note);
    if (!result) {
      return NextResponse.json(
        { error: 'Invite link is inactive (participant removed)' },
        { status: 404 }
      );
    }
    const owner = await prisma.deal_network_pilot_deals.findUnique({
      where: { id: result.deal.id },
      select: { user_id: true },
    });
    if (owner?.user_id) {
      await refreshDealNetworkPilotObligationsForUser(owner.user_id);
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error('[deal-network-pilot/invites/approve POST]', e);
    return NextResponse.json({ error: 'Failed to approve' }, { status: 500 });
  }
}
