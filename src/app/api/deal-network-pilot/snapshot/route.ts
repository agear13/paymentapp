/**
 * Rabbit Hole Deal Network pilot snapshot API.
 *
 * Frozen compatibility endpoint for Alex's production pilot. Shared repositories
 * can remain shared, but this route contract should not be changed by Agreements
 * work without explicit Rabbit Hole pilot approval.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import {
  getPilotSnapshotForUser,
  syncPilotSnapshotForUser,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import {
  orchestrateOperationalMutation,
  operationalSyncJson,
} from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
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

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = (await request.json()) as {
      deals?: RecentDeal[];
      participants?: DemoParticipant[];
      operation?: string;
    };
    if (body.operation !== 'workspace_import_replace') {
      return NextResponse.json(
        { error: 'Full snapshot persistence is restricted to explicit workspace import/replace operations' },
        { status: 409 }
      );
    }
    const deals = Array.isArray(body.deals) ? body.deals : [];
    const participants = Array.isArray(body.participants) ? body.participants : [];
    await syncPilotSnapshotForUser(user.id, deals, participants);
    const operationalSync = await orchestrateOperationalMutation({
      userId: user.id,
      mutation: 'snapshot_persist',
      projectId: deals[0]?.id,
    });
    return NextResponse.json({ ok: true, ...operationalSyncJson(operationalSync) });
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[deal-network-pilot/snapshot POST]', e);
    return NextResponse.json({ error: 'Failed to save pilot data' }, { status: 500 });
  }
}
