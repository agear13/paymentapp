import { NextRequest, NextResponse } from 'next/server';
import { findParticipantByPaymentSetupToken } from '@/lib/commercial/payment-setup.server';
import { recordPaymentPortalOpened } from '@/lib/commercial/payment-request.server';
import { buildSupplierOnboardingInput } from '@/lib/commercial/build-supplier-onboarding-input';
import { generateDraftInvoice } from '@/lib/commercial/supplier-onboarding';

/**
 * GET /api/payment-setup/[token]
 *
 * Public endpoint — no auth required.
 * Returns the participant and deal data needed to render the payment setup portal.
 *
 * Returns only the fields the supplier needs to see.
 * Never returns operator notes, internal IDs, or other participants' data.
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
