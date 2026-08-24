import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/middleware';
import {
  getPilotSnapshotForUser,
  participantRowToDemo,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { prisma } from '@/lib/server/prisma';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { repairScalarCompensationProfile } from '@/lib/participants/repair-scalar-compensation-profile';
import {
  orchestrateOperationalMutation,
  operationalSyncJson,
} from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';

const createParticipantSchema = z.object({
  participant: z.record(z.string(), z.unknown()),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = createParticipantSchema.parse(await request.json());
    const participant = body.participant as unknown as DemoParticipant;

    if (!participant.id || !participant.dealId || !participant.inviteToken) {
      return NextResponse.json(
        { error: 'Participant id, dealId, and inviteToken are required' },
        { status: 400 }
      );
    }

    const snapshot = await getPilotSnapshotForUser(user.id);
    const deal = snapshot.deals.find((d) => d.id === participant.dealId);
    if (!deal) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const existing = await prisma.deal_network_pilot_participants.findUnique({
      where: { id: participant.id },
    });
    if (existing) {
      return NextResponse.json({ error: 'Participant already exists' }, { status: 409 });
    }

    const { participant: repaired } = repairScalarCompensationProfile(participant);
    const toPersist = {
      ...repaired,
      id: participant.id,
      dealId: deal.id,
      inviteToken: participant.inviteToken,
    };

    const row = await prisma.deal_network_pilot_participants.create({
      data: {
        id: toPersist.id,
        deal_id: toPersist.dealId,
        invite_token: toPersist.inviteToken,
        name: toPersist.name,
        email: toPersist.email?.trim() ? toPersist.email : null,
        role: toPersist.role,
        role_details: toPersist.roleDetails ?? null,
        payout_condition: toPersist.payoutCondition ?? null,
        approval_status: toPersist.approvalStatus,
        approved_at: toPersist.approvedAt ? new Date(toPersist.approvedAt) : null,
        participant_payload: toPersist as unknown as Prisma.InputJsonValue,
      },
    });

    const persisted = participantRowToDemo(row);
    const operationalSync = await orchestrateOperationalMutation({
      userId: user.id,
      mutation: 'snapshot_persist',
      projectId: participant.dealId,
      focusParticipant: persisted,
    });

    return NextResponse.json({
      participant: persisted,
      ...operationalSyncJson(operationalSync),
    });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    console.error('[deal-network-pilot/participants POST]', e);
    return NextResponse.json({ error: 'Failed to create participant' }, { status: 500 });
  }
}
