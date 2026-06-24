import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/middleware';
import {
  getPilotSnapshotForUser,
  syncPilotSnapshotForUser,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { generatePaymentRequestForParticipant } from '@/lib/commercial/payment-request.server';
import {
  orchestrateOperationalMutation,
  operationalSyncJson,
} from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';

const bodySchema = z.object({
  sendEmail: z.boolean().optional(),
});

/**
 * POST /api/deal-network-pilot/participants/[participantId]/payment-request/generate
 *
 * Generates draft invoice + secure payment portal and transitions lifecycle to PAYMENT_INFO_PENDING.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ participantId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { participantId } = await context.params;
    const body = bodySchema.parse(await request.json().catch(() => ({})));

    const snapshot = await getPilotSnapshotForUser(user.id);
    const existing = snapshot.participants.find((p) => p.id === participantId);
    if (!existing) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    if (existing.approvalStatus !== 'Approved') {
      return NextResponse.json(
        { error: 'Participant must accept the agreement before sending a payment request.' },
        { status: 422 }
      );
    }

    const result = await generatePaymentRequestForParticipant(
      participantId,
      user.id,
      { sendEmail: body.sendEmail ?? false }
    );

    if (!result) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    const nextParticipants = snapshot.participants.map((p) =>
      p.id === participantId ? result.participant : p
    );
    await syncPilotSnapshotForUser(user.id, snapshot.deals, nextParticipants);

    const operationalSync = await orchestrateOperationalMutation({
      userId: user.id,
      mutation: 'supplier_onboarding',
      projectId: existing.dealId ?? snapshot.deals[0]?.id ?? '',
      focusParticipant: result.participant,
    });

    return NextResponse.json({
      participant: result.participant,
      portalUrl: result.portalUrl,
      tokenExpiresAt: result.tokenExpiresAt,
      emailSent: result.emailSent,
      emailError: result.emailError,
      message: result.emailSent
        ? `Payment request sent to ${existing.email}.`
        : 'Payment request ready — share the secure link with your participant.',
      ...operationalSyncJson(operationalSync),
    });
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: e.issues }, { status: 400 });
    }
    const err = e as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message === 'PARTICIPANT_NOT_APPROVED') {
      return NextResponse.json({ error: 'Agreement not yet accepted' }, { status: 422 });
    }
    console.error('[payment-request/generate POST]', e);
    return NextResponse.json({ error: 'Failed to generate payment request' }, { status: 500 });
  }
}
