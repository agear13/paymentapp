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
import {
  PARTICIPANT_COMPENSATION_TYPES,
} from '@/lib/participants/participant-compensation-types';
import {
  applyCompensationProfileToParticipant,
} from '@/lib/participants/participant-compensation';

const compensationProfileSchema = z.object({
  compensationType: z.enum(PARTICIPANT_COMPENSATION_TYPES),
  percentage: z.number().optional(),
  fixedAmount: z.number().optional(),
  revenueSources: z.array(z.string()).optional(),
  minimumGuarantee: z.number().optional(),
  payoutPriority: z.number().optional(),
  notes: z.string().max(2000).optional(),
  configured: z.boolean().optional(),
  configuredAt: z.string().optional(),
  exemptFromPayout: z.boolean().optional(),
});

const patchSchema = z
  .object({
    onboardingStatus: z.enum(['NOT_STARTED', 'INCOMPLETE', 'COMPLETE', 'BLOCKED']).optional(),
    name: z.string().min(1).max(255).optional(),
    email: z.string().email().max(255).optional().or(z.literal('')),
    role: z.enum(['Introducer', 'Connector', 'Closer', 'Contributor']).optional(),
    roleDetails: z.string().max(2000).optional(),
    agreementNotes: z.string().max(2000).optional(),
    compensationProfile: compensationProfileSchema.optional(),
  })
  .refine(
    (body) =>
      body.onboardingStatus != null ||
      body.name != null ||
      body.email != null ||
      body.role != null ||
      body.roleDetails != null ||
      body.agreementNotes != null ||
      body.compensationProfile != null,
    { message: 'No updates provided' }
  );

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

    const snapshot = await getPilotSnapshotForUser(user.id);
    const existing = snapshot.participants.find((p) => p.id === participantId);
    if (!existing) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    let working = existing;
    if (body.onboardingStatus) {
      working = applyOnboardingSelectValue(
        working,
        body.onboardingStatus as PilotParticipantOnboardingStatus | 'BLOCKED'
      );
    }

    const payloadPatch: Parameters<typeof updatePilotParticipantPayload>[2] = {};
    if (body.onboardingStatus) {
      payloadPatch.onboardingStatus = working.onboardingStatus;
      payloadPatch.payoutBlocked = working.payoutBlocked;
    }
    if (body.name != null) payloadPatch.name = body.name.trim();
    if (body.email != null) payloadPatch.email = body.email.trim();
    if (body.role != null) payloadPatch.role = body.role;
    if (body.roleDetails != null) payloadPatch.roleDetails = body.roleDetails;
    if (body.agreementNotes != null) payloadPatch.agreementNotes = body.agreementNotes;

    if (body.compensationProfile) {
      const profile = {
        ...body.compensationProfile,
        configured: body.compensationProfile.configured ?? true,
        configuredAt: body.compensationProfile.configuredAt ?? new Date().toISOString(),
      };
      const merged = applyCompensationProfileToParticipant(working, profile);
      payloadPatch.compensationProfile = merged.compensationProfile;
      payloadPatch.participationModel = merged.participationModel;
      payloadPatch.commissionKind = merged.commissionKind;
      payloadPatch.commissionValue = merged.commissionValue;
    }

    const persisted = await updatePilotParticipantPayload(participantId, user.id, payloadPatch);

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
