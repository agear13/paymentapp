import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  findParticipantByPaymentSetupToken,
  invalidatePaymentSetupToken,
} from '@/lib/commercial/payment-setup.server';
import { prisma } from '@/lib/server/prisma';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { Prisma } from '@prisma/client';
import {
  appendOnboardingEvent,
  buildSupplierVerification,
} from '@/lib/commercial/supplier-onboarding-domain';
import type { StoredOnboardingState } from '@/lib/commercial/supplier-onboarding-domain';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';

// Alias: the submit route has the deal owner's user_id, not an authenticated session
const getOrganizationForUser = getOrganizationForAuthenticatedUser;
import { dispatchCommercialNotification } from '@/lib/commercial/dispatch-commercial-notification.server';
import { v4 as uuidv4 } from 'uuid';
import {
  orchestrateOperationalMutation,
  operationalSyncJson,
} from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';

const paymentBankSchema = z.object({
  accountName: z.string().nullable(),
  bsb: z.string().nullable(),
  accountNumber: z.string().nullable(),
});

const submitSchema = z.object({
  payment: z.object({
    preference: z.enum(['bank_account', 'alternative']),
    bankDetails: paymentBankSchema.optional().default({ accountName: null, bsb: null, accountNumber: null }),
    alternativePaymentMethod: z.string().nullable().optional().default(null),
  }),
  abn: z.object({
    abn: z.string().nullable(),
    abnNotApplicable: z.boolean(),
    abnVerified: z.boolean(),
    businessName: z.string().nullable().optional().default(null),
  }),
  gst: z.object({
    gstStatus: z.enum(['yes', 'no', 'not_applicable', 'pending']),
  }),
  submission: z.object({
    submittedAt: z.string(),
    declarationAccepted: z.boolean(),
  }),
});

/**
 * POST /api/payment-setup/[token]/submit
 *
 * Public endpoint — authenticated by payment setup token only (no login required).
 *
 * Supplier submits their payment information from the public portal.
 * Invalidates the token after successful submission.
 * Dispatches operator notification.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    if (!token) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 400 });
    }

    const tokenResult = await findParticipantByPaymentSetupToken(token);
    if (!tokenResult) {
      return NextResponse.json(
        { error: 'This link has expired or is no longer valid.' },
        { status: 404 }
      );
    }

    const body = submitSchema.parse(await request.json());
    const { participant, participantDbId, dealId, deal } = tokenResult;

    const now = new Date().toISOString();
    const existingStored = participant.supplierOnboarding as StoredOnboardingState | undefined;

    // Append immutable event
    const submittedEvent = {
      id: uuidv4(),
      type: 'SUPPLIER_ONBOARDING_SUBMITTED' as const,
      participantId: participantDbId,
      performedBy: 'supplier',
      timestamp: now,
      payload: {
        payment: body.payment,
        abn: body.abn,
        gst: body.gst,
        declarationAccepted: body.submission.declarationAccepted,
      },
    };

    const updatedEvents = appendOnboardingEvent(existingStored?.events ?? [], submittedEvent);
    const updatedVerification = buildSupplierVerification(
      { ...existingStored, payment: body.payment, abn: body.abn },
      { supplierApproved: false }
    );

    const updatedOnboarding: StoredOnboardingState = {
      ...existingStored,
      payment: body.payment,
      abn: body.abn,
      gst: body.gst,
      submission: body.submission,
      operator: existingStored?.operator ?? { approvedAt: null, xeroExportedAt: null, notes: null },
      events: updatedEvents,
      verification: updatedVerification,
      lifecycle: 'SUBMITTED',
    };

    // Update draft invoice status if present
    const updatedDraftInvoice = participant.paymentSetup?.draftInvoice
      ? { ...participant.paymentSetup.draftInvoice, status: 'SUBMITTED' as const }
      : undefined;

    const updated: DemoParticipant = {
      ...participant,
      supplierOnboarding: updatedOnboarding,
      payoutOnboardingPhase: 'COMPLETED',
      onboardingStatus: 'COMPLETE',
      paymentSetup: {
        ...participant.paymentSetup,
        ...(updatedDraftInvoice ? { draftInvoice: updatedDraftInvoice } : {}),
      },
    };

    await prisma.deal_network_pilot_participants.update({
      where: { id: participantDbId },
      data: { participant_payload: updated as unknown as Prisma.InputJsonValue },
    });

    // Invalidate the token so the supplier cannot resubmit
    await invalidatePaymentSetupToken(participantDbId);

    // Notify operator and recompute operational state for all operator surfaces.
    const org = await getOrganizationForUser(deal.user_id);
    if (org) {
      void dispatchCommercialNotification({
        organizationId: org.id,
        eventKind: 'supplier_details_submitted',
        projectId: dealId,
        participantId: participantDbId,
        participantName: participant.name,
      });
    }

    const operationalSync = await orchestrateOperationalMutation({
      userId: deal.user_id,
      mutation: 'supplier_onboarding',
      projectId: dealId,
      focusParticipant: updated,
    });

    return NextResponse.json({
      success: true,
      lifecycle: 'SUBMITTED',
      ...operationalSyncJson(operationalSync),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: e.issues }, { status: 400 });
    }
    console.error('[payment-setup/submit POST]', e);
    return NextResponse.json({ error: 'Submission failed. Please try again.' }, { status: 500 });
  }
}
