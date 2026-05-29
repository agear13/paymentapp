import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/middleware';
import {
  getPilotSnapshotForUser,
  syncPilotSnapshotForUser,
  updatePilotParticipantPayload,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import {
  applyPayoutVerificationConfirmed,
} from '@/lib/projects/participant-lifecycle';
import {
  PARTICIPANT_COMPENSATION_TYPES,
} from '@/lib/participants/participant-compensation-types';
import {
  orchestrateOperationalMutation,
  operationalSyncJson,
} from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';
import { normalizeCompensationAttributionSemantics } from '@/lib/operations/derivations/derive-currency-consistency';
import { applyCompensationProfileToParticipant } from '@/lib/participants/participant-compensation';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { prisma } from '@/lib/server/prisma';
import { isAttributionAllActiveWithoutCatalog } from '@/lib/operations/truth/attribution-eligibility';
import { ATTRIBUTION_ALL_ACTIVE_WITHOUT_SERVICES } from '@/lib/operations/merchant-operational-copy';
import { assertOperationalInvariants } from '@/lib/operations/dev/operational-invariants';
import { logParticipantEarningsPersistenceDiagnostic } from '@/lib/operations/dev/participant-earnings-persistence-diagnostic';

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
  customerAttributionEnabled: z.boolean().optional(),
  commissionSourceMode: z.enum(['all_active', 'selected']).optional(),
  commissionServiceIds: z.array(z.string()).optional(),
});

const patchSchema = z
  .object({
    payoutVerificationConfirmed: z.boolean().optional(),
    name: z.string().min(1).max(255).optional(),
    email: z.string().email().max(255).optional().or(z.literal('')),
    role: z.enum(['Introducer', 'Connector', 'Closer', 'Contributor']).optional(),
    roleDetails: z.string().max(2000).optional(),
    agreementNotes: z.string().max(2000).optional(),
    compensationProfile: compensationProfileSchema.optional(),
  })
  .refine(
    (body) =>
      body.payoutVerificationConfirmed != null ||
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
 * Operator updates participant coordination state (project + pilot snapshot sync).
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
    if (body.payoutVerificationConfirmed != null) {
      working = applyPayoutVerificationConfirmed(working, body.payoutVerificationConfirmed);
    }

    const payloadPatch: Parameters<typeof updatePilotParticipantPayload>[2] = {};
    if (body.payoutVerificationConfirmed != null) {
      payloadPatch.payoutVerificationConfirmed = working.payoutVerificationConfirmed;
      payloadPatch.payoutVerificationConfirmedAt = working.payoutVerificationConfirmedAt;
      payloadPatch.onboardingStatus = working.onboardingStatus;
      payloadPatch.payoutOnboardingPhase = working.payoutOnboardingPhase;
      payloadPatch.payoutBlocked = working.payoutBlocked;
    }
    if (body.name != null) payloadPatch.name = body.name.trim();
    if (body.email != null) payloadPatch.email = body.email.trim();
    if (body.role != null) payloadPatch.role = body.role;
    if (body.roleDetails != null) payloadPatch.roleDetails = body.roleDetails;
    if (body.agreementNotes != null) payloadPatch.agreementNotes = body.agreementNotes;

    if (body.compensationProfile) {
      const org = await getOrganizationForAuthenticatedUser(user.id);
      const activeCatalogCount = org
        ? await prisma.organization_services.count({
            where: { organization_id: org.id, active: true },
          })
        : 0;

      const profileInput = {
        ...body.compensationProfile,
        configured: body.compensationProfile.configured ?? true,
        configuredAt: body.compensationProfile.configuredAt ?? new Date().toISOString(),
      };

      if (
        isAttributionAllActiveWithoutCatalog({
          compensationType: profileInput.compensationType,
          customerAttributionEnabled: profileInput.customerAttributionEnabled,
          commissionSourceMode: profileInput.commissionSourceMode,
          activeCatalogCount,
        })
      ) {
        assertOperationalInvariants({
          participantId,
          attributionEnabledWithoutActiveServices: true,
        });
        return NextResponse.json(
          { error: ATTRIBUTION_ALL_ACTIVE_WITHOUT_SERVICES.message },
          { status: 422 }
        );
      }

      const normalized = normalizeCompensationAttributionSemantics(working, profileInput);
      const merged = applyCompensationProfileToParticipant(working, normalized.profile);
      payloadPatch.compensationProfile = merged.compensationProfile;
      payloadPatch.participationModel = merged.participationModel;
      payloadPatch.commissionKind = merged.commissionKind;
      payloadPatch.commissionValue = merged.commissionValue;
    }

    const persisted = await updatePilotParticipantPayload(participantId, user.id, payloadPatch);

    if (!persisted) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    if (body.compensationProfile) {
      logParticipantEarningsPersistenceDiagnostic('save-persisted', persisted, {}, {
        mutation: 'participant_earnings_save',
        payloadConfigured: body.compensationProfile.configured ?? true,
        payloadConfiguredAt: body.compensationProfile.configuredAt ?? null,
      });
    }

    const nextParticipants = snapshot.participants.map((p) =>
      p.id === participantId ? persisted : p
    );
    await syncPilotSnapshotForUser(user.id, snapshot.deals, nextParticipants);

    const mutation = body.compensationProfile
      ? 'participant_earnings_save'
      : body.payoutVerificationConfirmed != null
        ? 'payout_verification'
        : 'snapshot_persist';

    const operationalSync = await orchestrateOperationalMutation({
      userId: user.id,
      mutation,
      projectId: persisted.dealId ?? snapshot.deals[0]?.id,
      focusParticipant: persisted,
    });

    return NextResponse.json({
      participant: persisted,
      ...operationalSyncJson(operationalSync),
    });
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
