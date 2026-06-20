import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/middleware';
import {
  getPilotSnapshotForUser,
  updatePilotParticipantPayload,
  syncPilotSnapshotForUser,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { dispatchCommercialNotification } from '@/lib/commercial/dispatch-commercial-notification.server';
import {
  appendOnboardingEvent,
  buildSupplierVerification,
} from '@/lib/commercial/supplier-onboarding-domain';
import type { StoredOnboardingState } from '@/lib/commercial/supplier-onboarding-domain';
import { v4 as uuidv4 } from 'uuid';

const paymentBankSchema = z.object({
  accountName: z.string().nullable(),
  bsb: z.string().nullable(),
  accountNumber: z.string().nullable(),
});

const paymentSchema = z.object({
  preference: z.enum(['bank_account', 'alternative']),
  bankDetails: paymentBankSchema.optional().default({ accountName: null, bsb: null, accountNumber: null }),
  alternativePaymentMethod: z.string().nullable().optional().default(null),
});

const abnSchema = z.object({
  abn: z.string().nullable(),
  abnNotApplicable: z.boolean(),
  abnVerified: z.boolean(),
  businessName: z.string().nullable().optional().default(null),
});

const gstSchema = z.object({
  gstStatus: z.enum(['yes', 'no', 'not_applicable', 'pending']),
});

const submissionSchema = z.object({
  submittedAt: z.string(),
  declarationAccepted: z.boolean(),
});

const submitBodySchema = z.object({
  payment: paymentSchema,
  abn: abnSchema,
  gst: gstSchema,
  submission: submissionSchema,
});

/**
 * POST /api/deal-network-pilot/participants/[participantId]/supplier-onboarding
 *
 * Supplier submits their onboarding form (payment details, ABN, GST status,
 * declaration).
 *
 * Domain actions:
 *   1. Appends a SUPPLIER_ONBOARDING_SUBMITTED event to the event log.
 *   2. Persists form data (payment, abn, gst, submission).
 *   3. Sets lifecycle = 'SUBMITTED'.
 *   4. Fires a supplier_details_submitted notification to the operator.
 *
 * Does NOT approve, does NOT create accounting records.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ participantId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { participantId } = await context.params;
    const body = submitBodySchema.parse(await request.json());

    const snapshot = await getPilotSnapshotForUser(user.id);
    const existing = snapshot.participants.find((p) => p.id === participantId);
    if (!existing) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const existingStored = existing.supplierOnboarding as StoredOnboardingState | undefined;

    // Append immutable SUBMITTED event
    const submittedEvent = {
      id: uuidv4(),
      type: 'SUPPLIER_ONBOARDING_SUBMITTED' as const,
      participantId,
      performedBy: user.id,
      timestamp: now,
      payload: {
        payment: body.payment,
        abn: body.abn,
        gst: body.gst,
        declarationAccepted: body.submission.declarationAccepted,
      },
    };

    const updatedEvents = appendOnboardingEvent(existingStored?.events ?? [], submittedEvent);

    // Derive updated verification (auto-detect tax/bank from submitted data)
    const updatedVerification = buildSupplierVerification(
      { ...existingStored, payment: body.payment, abn: body.abn },
      { supplierApproved: false } // approval requires explicit operator action
    );

    const onboardingData: StoredOnboardingState = {
      ...existingStored,
      payment: body.payment,
      abn: body.abn,
      gst: body.gst,
      submission: body.submission,
      operator: existingStored?.operator ?? {
        approvedAt: null,
        xeroExportedAt: null,
        notes: null,
      },
      events: updatedEvents,
      verification: updatedVerification,
      lifecycle: 'SUBMITTED',
    };

    const persisted = await updatePilotParticipantPayload(participantId, user.id, {
      supplierOnboarding: onboardingData,
      payoutOnboardingPhase: 'COMPLETED',
      onboardingStatus: 'COMPLETE',
    });

    if (!persisted) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    const nextParticipants = snapshot.participants.map((p) =>
      p.id === participantId ? persisted : p
    );
    await syncPilotSnapshotForUser(user.id, snapshot.deals, nextParticipants);

    const org = await getOrganizationForAuthenticatedUser(user.id);
    if (org) {
      void dispatchCommercialNotification({
        organizationId: org.id,
        eventKind: 'supplier_details_submitted',
        projectId: existing.dealId ?? snapshot.deals[0]?.id ?? '',
        participantId: existing.id,
        participantName: existing.name,
      });
    }

    return NextResponse.json({ participant: persisted });
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: e.issues }, { status: 400 });
    }
    const err = e as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[supplier-onboarding POST]', e);
    return NextResponse.json({ error: 'Failed to save onboarding data' }, { status: 500 });
  }
}
