import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import {
  getPilotSnapshotForUser,
  syncPilotSnapshotForUser,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireAuth();
    const snapshot = await getPilotSnapshotForUser(user.id);
    return NextResponse.json(snapshot);
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[deal-network-pilot/snapshot GET]', e);
    return NextResponse.json({ error: 'Failed to load pilot data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = (await request.json()) as {
      deals?: RecentDeal[];
      participants?: DemoParticipant[];
    };
    const deals = Array.isArray(body.deals) ? body.deals : [];
    const participants = Array.isArray(body.participants) ? body.participants : [];
    await syncPilotSnapshotForUser(user.id, deals, participants);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[deal-network-pilot/snapshot POST]', e);
    return NextResponse.json({ error: 'Failed to save pilot data' }, { status: 500 });
  }
}
