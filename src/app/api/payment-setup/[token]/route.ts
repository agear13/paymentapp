import { NextRequest, NextResponse } from 'next/server';
import { findParticipantByPaymentSetupToken } from '@/lib/commercial/payment-setup.server';
import { recordPaymentPortalOpened } from '@/lib/commercial/payment-request.server';
import { buildSupplierOnboardingInput } from '@/lib/commercial/build-supplier-onboarding-input';
import { generateDraftInvoice } from '@/lib/commercial/supplier-onboarding';
import {
  authorizeParticipantRelationship,
  getParticipantSessionUser,
  participantAuthDeniedResponse,
} from '@/lib/participant-portal/participant-session.server';

/**
 * GET /api/payment-setup/[token]
 *
 * Requires an authenticated participant session that matches this payout invitation.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  if (!token) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 400 });
  }

  const result = await findParticipantByPaymentSetupToken(token);
  if (!result) {
    return NextResponse.json(
      { error: 'This link has expired or is no longer valid. Please contact your organiser for a new link.' },
      { status: 404 }
    );
  }

  const user = await getParticipantSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required', code: 'UNAUTHENTICATED' },
      { status: 401 }
    );
  }
  const access = await authorizeParticipantRelationship({
    user,
    participantId: result.participantDbId,
    participantEmail: result.participantEmail,
    authenticatedUserId: result.authenticatedUserId,
    dealOwnerUserId: result.deal.user_id,
    action: 'read',
  });
  if (access.status !== 'ok') {
    return participantAuthDeniedResponse();
  }

  const { participant } = result;
  const deal = result.deal.deal_payload as { dealName?: string; id?: string };

  void recordPaymentPortalOpened(participant.id);

  // Build the onboarding input to derive the current draft invoice
  const input = buildSupplierOnboardingInput(participant, {
    id: result.dealId,
    name: deal.dealName ?? 'Your project',
  });

  // Use persisted draft invoice if available, otherwise derive on the fly
  const draftInvoice = participant.paymentSetup?.draftInvoice ?? generateDraftInvoice(input);

  // Build safe response — only what the supplier needs
  return NextResponse.json({
    participantId: participant.id,
    participantName: participant.name,
    participantRole: participant.role,
    projectName: deal.dealName ?? 'Your project',
    draftInvoice,
    existingPayment: participant.supplierOnboarding?.payment ?? null,
    existingAbn: participant.supplierOnboarding?.abn ?? null,
    existingGst: participant.supplierOnboarding?.gst ?? null,
    lifecycle: participant.supplierOnboarding?.lifecycle ?? 'NOT_STARTED',
    attachments: participant.paymentSetup?.attachments ?? [],
    rejectionReason: participant.supplierOnboarding?.rejection?.reason ?? null,
  });
}
