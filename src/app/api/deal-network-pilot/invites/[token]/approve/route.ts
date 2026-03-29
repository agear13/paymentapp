import { NextResponse } from 'next/server';
import { approveParticipantByInviteToken } from '@/lib/deal-network-demo/pilot-snapshot.server';

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
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error('[deal-network-pilot/invites/approve POST]', e);
    return NextResponse.json({ error: 'Failed to approve' }, { status: 500 });
  }
}
