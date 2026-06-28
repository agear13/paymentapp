import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/middleware';
import {
  getPilotSnapshotForUser,
  updatePilotParticipantPayload,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { dispatchCommercialNotification } from '@/lib/commercial/dispatch-commercial-notification.server';
import { applyPayoutVerificationConfirmed } from '@/lib/projects/participant-lifecycle';
import {
  appendOnboardingEvent,
  buildSupplierVerification,
  nextApprovalVersion,
} from '@/lib/commercial/supplier-onboarding-domain';
import type { StoredOnboardingState, ApprovalMetadata } from '@/lib/commercial/supplier-onboarding-domain';
import { v4 as uuidv4 } from 'uuid';

const approveBodySchema = z.object({
  approvalNotes: z.string().max(2000).optional(),
});

/**
 * POST /api/deal-network-pilot/participants/[participantId]/supplier-onboarding/approve
 *
 * Operator approves the supplier's submitted onboarding.
 *
 * This is a COMMERCIAL DECISION only.
 * It does NOT export to Xero. It does NOT create accounting records.
 * Accounting export is a separate downstream concern that reacts to APPROVED state.
 *
 * Domain actions:
 *   1. Appends a SUPPLIER_ONBOARDING_APPROVED event to the event log.
 *   2. Persists ApprovalMetadata (approvedBy, approvedAt, approvalNotes, approvalVersion).
 *   3. Sets SupplierVerification.supplierApproved = true.
 *   4. Sets lifecycle = 'APPROVED'.
 *   5. Sets payoutVerificationConfirmed = true for backwards compatibility.
 *   6. Fires supplier_onboarding_approved notification.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ participantId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { participantId } = await context.params;
    const body = approveBodySchema.parse(await request.json());

    const snapshot = await getPilotSnapshotForUser(user.id);
    const existing = snapshot.participants.find((p) => p.id === participantId);
    if (!existing) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    const existingStored = existing.supplierOnboarding as StoredOnboardingState | undefined;

    if (!existingStored?.submission?.submittedAt) {
      return NextResponse.json(
        { error: 'Supplier has not yet submitted their onboarding form' },
        { status: 422 }
      );
    }

    const now = new Date().toISOString();
    const existingEvents = existingStored?.events ?? [];
    const version = nextApprovalVersion(existingEvents);

    // Append immutable APPROVED event
    const approvedEvent = {
      id: uuidv4(),
      type: 'SUPPLIER_ONBOARDING_APPROVED' as const,
      participantId,
      performedBy: user.id,
      timestamp: now,
      payload: {
        approvalNotes: body.approvalNotes,
        approvalVersion: version,
      },
    };

    const updatedEvents = appendOnboardingEvent(existingEvents, approvedEvent);

    // Full approval metadata
    const approvalMetadata: ApprovalMetadata = {
      approvedBy: user.id,
      approvedAt: now,
      approvalNotes: body.approvalNotes ?? null,
      approvalVersion: version,
    };

    // Update verification: operator approval + auto-derive tax/bank
    const updatedVerification = buildSupplierVerification(existingStored, {
      supplierApproved: true,
    });

    const updatedOnboarding: StoredOnboardingState = {
      ...existingStored,
      operator: {
        approvedAt: now,
        xeroExportedAt: existingStored?.operator?.xeroExportedAt ?? null,
        notes: body.approvalNotes ?? existingStored?.operator?.notes ?? null,
      },
      events: updatedEvents,
      verification: updatedVerification,
      approval: approvalMetadata,
      // Clear any previous rejection metadata on re-approval
      rejection: undefined,
      lifecycle: 'APPROVED',
    };

    const withVerification = applyPayoutVerificationConfirmed(existing, true);

    const persisted = await updatePilotParticipantPayload(participantId, user.id, {
      ...withVerification,
      supplierOnboarding: updatedOnboarding,
      payoutVerificationConfirmed: true,
      payoutVerificationConfirmedAt: now,
    });

    if (!persisted) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    const org = await getOrganizationForAuthenticatedUser(user.id);
    if (org) {
      void dispatchCommercialNotification({
        organizationId: org.id,
        eventKind: 'supplier_onboarding_approved',
        projectId: existing.dealId ?? snapshot.deals[0]?.id ?? '',
        participantId: existing.id,
        participantName: existing.name,
      });
    }

    return NextResponse.json({
      participant: persisted,
      approvalVersion: version,
      lifecycle: 'APPROVED',
    });
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: e.issues }, { status: 400 });
    }
    const err = e as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[supplier-onboarding/approve POST]', e);
    return NextResponse.json({ error: 'Failed to approve onboarding' }, { status: 500 });
  }
}
