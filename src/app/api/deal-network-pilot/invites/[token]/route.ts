import { NextResponse } from 'next/server';
import {
  dealRowToRecentDeal,
  markParticipantInviteOpened,
  participantRowToDemo,
  getParticipantByInviteToken,
  getPilotParticipantsForDeal,
} from '@/lib/deal-network-demo/pilot-snapshot.server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token: raw } = await context.params;
  const token = decodeURIComponent(raw ?? '');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  try {
    const row = await getParticipantByInviteToken(token);
    if (!row || !row.deal) {
      return NextResponse.json(
        { error: 'Invite link is inactive (participant removed)' },
        { status: 404 }
      );
    }

    await markParticipantInviteOpened(token);

    const deal = dealRowToRecentDeal(row.deal);
    const participant = { ...participantRowToDemo(row), inviteStatus: 'Opened' as const };
    const dealParticipants = await getPilotParticipantsForDeal(row.deal_id);
    return NextResponse.json({ deal, participant, dealParticipants });
  } catch (e) {
    console.error('[deal-network-pilot/invites GET]', e);
    return NextResponse.json({ error: 'Failed to load invite' }, { status: 500 });
  }
}
