import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/middleware';
import {
  getPilotSnapshotForUser,
  updatePilotParticipantPayload,
  syncPilotSnapshotForUser,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import {
  appendOnboardingEvent,
  buildSupplierVerification,
} from '@/lib/commercial/supplier-onboarding-domain';
import type { StoredOnboardingState } from '@/lib/commercial/supplier-onboarding-domain';
import {
  createPaymentSetupToken,
  persistPaymentSetupToken,
} from '@/lib/commercial/payment-setup.server';
import { sendEmail } from '@/lib/email/client';
import { buildPaymentSetupInviteEmail } from '@/lib/email/templates/payment-setup-invite';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { log } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';

const bodySchema = z.object({
  requestedChanges: z.string().min(1).max(2000),
});

/**
 * POST /api/deal-network-pilot/participants/[participantId]/supplier-onboarding/request-changes
 *
 * Operator requests changes without fully rejecting the commercial relationship.
 * Supplier can update and resubmit via a fresh payment setup link.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ participantId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { participantId } = await context.params;
    const body = bodySchema.parse(await request.json());

    const snapshot = await getPilotSnapshotForUser(user.id);
    const existing = snapshot.participants.find((p) => p.id === participantId);
    if (!existing) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    const existingStored = existing.supplierOnboarding as StoredOnboardingState | undefined;

    if (!existingStored?.submission?.submittedAt) {
      return NextResponse.json(
        { error: 'Supplier has not yet submitted payment & tax information' },
        { status: 422 }
      );
    }

    const now = new Date().toISOString();

    const changesEvent = {
      id: uuidv4(),
      type: 'SUPPLIER_ONBOARDING_CHANGES_REQUESTED' as const,
      participantId,
      performedBy: user.id,
      timestamp: now,
      payload: {
        requestedChanges: body.requestedChanges,
      },
    };

    const updatedEvents = appendOnboardingEvent(existingStored?.events ?? [], changesEvent);
    const updatedVerification = buildSupplierVerification(existingStored, {
      supplierApproved: false,
    });

    const updatedOnboarding: StoredOnboardingState = {
      ...existingStored,
      events: updatedEvents,
      verification: updatedVerification,
      lifecycle: 'IN_PROGRESS',
    };

    const persisted = await updatePilotParticipantPayload(participantId, user.id, {
      supplierOnboarding: updatedOnboarding,
      payoutVerificationConfirmed: false,
    });

    if (!persisted) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    const nextParticipants = snapshot.participants.map((p) =>
      p.id === participantId ? persisted : p
    );
    await syncPilotSnapshotForUser(user.id, snapshot.deals, nextParticipants);

    void (async () => {
      try {
        const tokenData = createPaymentSetupToken();
        await persistPaymentSetupToken(participantId, tokenData);

        const supplierEmail = existing.email;
        if (supplierEmail) {
          const org = await getOrganizationForAuthenticatedUser(user.id);
          const dealName = snapshot.deals[0]?.dealName ?? 'Your project';
          const appUrl =
            process.env.NEXT_PUBLIC_APP_URL ??
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://app.provvypay.com');
          const portalUrl = `${appUrl}/payment-setup/${tokenData.token}`;

          const emailContent = buildPaymentSetupInviteEmail({
            supplierName: existing.name,
            operatorName: org?.name ?? 'Your organiser',
            projectName: dealName,
            invoiceTotal: '',
            portalUrl,
            expiresAt: tokenData.tokenExpiresAt,
          });

          await sendEmail({
            to: supplierEmail,
            subject: `Changes requested — update your payment & tax information for ${dealName}`,
            html: emailContent.html,
            text: `${body.requestedChanges}\n\n${emailContent.text}`,
            tags: [{ name: 'category', value: 'payment-tax-changes-requested' }],
          });
        }
      } catch (err) {
        log.error('request-changes: failed to send payment setup link', undefined, {
          participantId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return NextResponse.json({
      participant: persisted,
      lifecycle: 'IN_PROGRESS',
      requestedChanges: body.requestedChanges,
    });
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: e.issues }, { status: 400 });
    }
    const err = e as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[supplier-onboarding/request-changes POST]', e);
    return NextResponse.json({ error: 'Failed to request changes' }, { status: 500 });
  }
}
