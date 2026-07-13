import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import {
  getPilotSnapshotForUser,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import {
  createPaymentSetupToken,
  persistPaymentSetupToken,
} from '@/lib/commercial/payment-setup.server';
import { sendEmail } from '@/lib/email/client';
import { buildPaymentSetupInviteEmail } from '@/lib/email/templates/payment-setup-invite';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { buildParticipantWorkspacePayoutUrlForParticipant } from '@/lib/participant-portal/participant-workspace-redirect.server';
import { log } from '@/lib/logger';

/**
 * POST /api/deal-network-pilot/participants/[participantId]/supplier-onboarding/resend
 *
 * Operator-initiated resend of the payment setup link.
 *
 * Generates a fresh token (invalidates the old one) and re-sends the email.
 * Allowed in any lifecycle state except APPROVED or xero_exported.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ participantId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { participantId } = await context.params;

    const snapshot = await getPilotSnapshotForUser(user.id);
    const existing = snapshot.participants.find((p) => p.id === participantId);
    if (!existing) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    const supplierEmail = existing.email;
    if (!supplierEmail) {
      return NextResponse.json(
        { error: 'This participant does not have an email address on record.' },
        { status: 422 }
      );
    }

    // Generate a new token (old token is replaced by persistPaymentSetupToken)
    const tokenData = createPaymentSetupToken();
    await persistPaymentSetupToken(participantId, tokenData);

    const org = await getOrganizationForAuthenticatedUser(user.id);
    const dealName = snapshot.deals[0]?.dealName ?? 'Your project';

    const portalUrl =
      (await buildParticipantWorkspacePayoutUrlForParticipant(participantId)) ??
      `${process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://app.provvypay.com')}/payment-setup/${tokenData.token}`;

    const invoiceTotal = existing.paymentSetup?.draftInvoice
      ? new Intl.NumberFormat('en-AU', {
          style: 'currency',
          currency: existing.paymentSetup.draftInvoice.currency,
        }).format(existing.paymentSetup.draftInvoice.total)
      : '';

    const emailContent = buildPaymentSetupInviteEmail({
      supplierName: existing.name,
      operatorName: org?.name ?? 'Your organiser',
      projectName: dealName,
      invoiceTotal,
      portalUrl,
      expiresAt: tokenData.tokenExpiresAt,
    });

    let emailSent = false;
    try {
      await sendEmail({
        to: supplierEmail,
        subject: `Reminder: Complete your payment information for ${dealName}`,
        html: emailContent.html,
        text: emailContent.text,
        tags: [{ name: 'category', value: 'payment-setup-resend' }],
      });
      emailSent = true;
    } catch (emailErr) {
      log.error('resend: email dispatch failed', undefined, {
        participantId,
        error: emailErr instanceof Error ? emailErr.message : String(emailErr),
      });
    }

    return NextResponse.json({
      sent: emailSent,
      portalUrl,
      tokenExpiresAt: tokenData.tokenExpiresAt,
      message: emailSent
        ? `Payment setup link resent to ${supplierEmail}.`
        : `New link generated but email could not be delivered. Share this link manually: ${portalUrl}`,
    });
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    log.error('resend: unexpected error', undefined, {
      error: err.message ?? String(e),
    });
    return NextResponse.json({ error: 'Failed to resend payment setup link' }, { status: 500 });
  }
}
