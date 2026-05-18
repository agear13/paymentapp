import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/middleware';
import {
  getPilotSnapshotForUser,
  syncPilotSnapshotForUser,
  updatePilotParticipantPayload,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { applyOnboardingSelectValue } from '@/lib/projects/participant-lifecycle';
import type { PilotParticipantOnboardingStatus } from '@/lib/deal-network-demo/participant-onboarding';

const patchSchema = z.object({
  onboardingStatus: z.enum(['NOT_STARTED', 'INCOMPLETE', 'COMPLETE', 'BLOCKED']).optional(),
});

/**
 * PATCH /api/deal-network-pilot/participants/[participantId]
 * Operator updates payout onboarding tracking (project + pilot snapshot sync).
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ participantId: string }> }
) {
  try {
    const user = await requireAuth();
    const { participantId } = await context.params;
    const body = patchSchema.parse(await request.json());

    if (!body.onboardingStatus) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const snapshot = await getPilotSnapshotForUser(user.id);
    const existing = snapshot.participants.find((p) => p.id === participantId);
    if (!existing) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    const patched = applyOnboardingSelectValue(
      existing,
      body.onboardingStatus as PilotParticipantOnboardingStatus | 'BLOCKED'
    );

    const persisted = await updatePilotParticipantPayload(participantId, user.id, {
      onboardingStatus: patched.onboardingStatus,
      payoutBlocked: patched.payoutBlocked,
    });

    if (!persisted) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    const nextParticipants = snapshot.participants.map((p) =>
      p.id === participantId ? persisted : p
    );
    await syncPilotSnapshotForUser(user.id, snapshot.deals, nextParticipants);

    return NextResponse.json({ participant: persisted });
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    console.error('[deal-network-pilot/participants PATCH]', e);
    return NextResponse.json({ error: 'Failed to update participant' }, { status: 500 });
  }
}
