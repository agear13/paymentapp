import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/middleware';
import {
  getPilotSnapshotForUser,
  updatePilotParticipantPayload,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import {
  appendOnboardingEvent,
  buildSupplierVerification,
} from '@/lib/commercial/supplier-onboarding-domain';
import type { StoredOnboardingState, RejectionMetadata } from '@/lib/commercial/supplier-onboarding-domain';
import {
  createPaymentSetupToken,
  persistPaymentSetupToken,
} from '@/lib/commercial/payment-setup.server';
import { sendEmail } from '@/lib/email/client';
import { buildPaymentSetupInviteEmail } from '@/lib/email/templates/payment-setup-invite';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { buildParticipantWorkspacePayoutUrlForParticipant } from '@/lib/participant-portal/participant-workspace-redirect.server';
import { log } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';

const rejectBodySchema = z.object({
  reason: z.string().min(1).max(2000),
});

/**
 * POST /api/deal-network-pilot/participants/[participantId]/supplier-onboarding/reject
 *
 * Operator rejects the supplier's submitted onboarding.
 *
 * Domain actions:
 *   1. Appends a SUPPLIER_ONBOARDING_REJECTED event.
 *   2. Persists RejectionMetadata (rejectedBy, rejectedAt, reason).
 *   3. Sets SupplierVerification.supplierApproved = false.
 *   4. Sets lifecycle = 'REJECTED'.
 *   5. Does NOT set payoutVerificationConfirmed (remains false).
 *
 * After rejection, the supplier can resubmit → lifecycle returns to IN_PROGRESS/SUBMITTED.
 * Rejection does NOT permanently lock onboarding.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ participantId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { participantId } = await context.params;
    const body = rejectBodySchema.parse(await request.json());

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

    const rejectedEvent = {
      id: uuidv4(),
      type: 'SUPPLIER_ONBOARDING_REJECTED' as const,
      participantId,
      performedBy: user.id,
      timestamp: now,
      payload: {
        reason: body.reason,
      },
    };

    const updatedEvents = appendOnboardingEvent(existingStored?.events ?? [], rejectedEvent);

    const rejectionMetadata: RejectionMetadata = {
      rejectedBy: user.id,
      rejectedAt: now,
      reason: body.reason,
    };

    const updatedVerification = buildSupplierVerification(existingStored, {
      supplierApproved: false,
    });

    const updatedOnboarding: StoredOnboardingState = {
      ...existingStored,
      events: updatedEvents,
      verification: updatedVerification,
      rejection: rejectionMetadata,
      // Preserve approval metadata history (do not erase it on rejection)
      lifecycle: 'REJECTED',
    };

    const persisted = await updatePilotParticipantPayload(participantId, user.id, {
      supplierOnboarding: updatedOnboarding,
      // Ensure payoutVerificationConfirmed is not set (rejection revokes approval)
      payoutVerificationConfirmed: false,
    });

    if (!persisted) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    // Regenerate payment setup token so the supplier can resubmit via a new secure link
    let newPortalUrl: string | null = null;
    void (async () => {
      try {
        const tokenData = createPaymentSetupToken();
        await persistPaymentSetupToken(participantId, tokenData);

        const supplierEmail = existing.email;
        if (supplierEmail) {
          const org = await getOrganizationForAuthenticatedUser(user.id);
          const dealName = snapshot.deals[0]?.dealName ?? 'Your project';
          const portalUrl =
            (await buildParticipantWorkspacePayoutUrlForParticipant(participantId)) ??
            `${process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://app.provvypay.com')}/payment-setup/${tokenData.token}`;
          newPortalUrl = portalUrl;
          const invoiceTotal = existing.paymentSetup?.draftInvoice
            ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: existing.paymentSetup.draftInvoice.currency }).format(existing.paymentSetup.draftInvoice.total)
            : '';

          const emailContent = buildPaymentSetupInviteEmail({
            supplierName: existing.name,
            operatorName: org?.name ?? 'Your organiser',
            projectName: dealName,
            invoiceTotal,
            portalUrl,
            expiresAt: tokenData.tokenExpiresAt,
          });

          await sendEmail({
            to: supplierEmail,
            subject: `Action required: Changes requested to your payment information for ${dealName}`,
            html: emailContent.html.replace(
              'Complete your payment information',
              'Changes have been requested — please update your payment information'
            ),
            text: emailContent.text,
            tags: [{ name: 'category', value: 'payment-setup-revision' }],
          });
        }
      } catch (err) {
        log.error('reject: failed to regenerate payment setup token', undefined, {
          participantId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return NextResponse.json({
      participant: persisted,
      lifecycle: 'REJECTED',
      reason: body.reason,
      portalUrl: newPortalUrl,
    });
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: e.issues }, { status: 400 });
    }
    const err = e as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[supplier-onboarding/reject POST]', e);
    return NextResponse.json({ error: 'Failed to reject onboarding' }, { status: 500 });
  }
}
