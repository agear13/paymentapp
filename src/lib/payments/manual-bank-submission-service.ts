/**
 * Record payer manual bank-transfer submission for MANUAL_BANK invoices.
 * Pilot behavior: payer submission marks invoice PAID_UNVERIFIED (verify-after-send model).
 */

import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';
import type { PaymentLinkStatus } from '@prisma/client';
import { verifyManualConfirmationBase } from '@/lib/payments/manual-confirmation-verification';
import { statusAfterManualConfirmationVerification } from '@/lib/payments/payment-confirmation-lifecycle';

export type SubmitManualBankConfirmationParams = {
  paymentLinkId: string;
  shortCode: string;
  payerAmountSent: string;
  payerCurrency?: string | null;
  payerDestination?: string | null;
  payerPaymentMethodUsed?: string | null;
  payerReference?: string | null;
  payerProofDetails?: string | null;
  payerNote?: string | null;
};

export type SubmitManualBankConfirmationResult = {
  confirmationId: string;
  paymentLinkStatus: PaymentLinkStatus;
  verification_status: string;
  match_confidence: string;
  verification_issues: string[];
};

export async function submitManualBankPaymentConfirmation(
  params: SubmitManualBankConfirmationParams
): Promise<SubmitManualBankConfirmationResult> {
  return await prisma.$transaction(async (tx) => {
    const link = await tx.payment_links.findUnique({
      where: { id: params.paymentLinkId },
    });

    if (!link) {
      throw new Error('Payment link not found');
    }
    if (link.status !== 'OPEN') {
      throw new Error('Invoice is not open for payment');
    }
    if (link.invoice_only_mode || link.payment_method !== 'MANUAL_BANK') {
      throw new Error('Manual bank submission is not available for this invoice');
    }

    const verification = verifyManualConfirmationBase({
      expectedAmount: Number(link.amount),
      expectedCurrency: link.currency,
      submittedAmount: params.payerAmountSent,
      submittedCurrency: params.payerCurrency,
      expectedDestinationLabel: 'Recipient',
      expectedDestinationValue: link.manual_bank_recipient_name,
      submittedDestinationLabel: 'Recipient',
      submittedDestinationValue: params.payerDestination,
      submittedReference: params.payerReference,
      submittedProof: params.payerProofDetails,
    });
    const confirmationId = randomUUID();
    const nextStatus: PaymentLinkStatus = statusAfterManualConfirmationVerification({
      verification_status: verification.verification_status,
      match_confidence: verification.match_confidence,
    });

    await tx.manual_bank_payment_confirmations.create({
      data: {
        id: confirmationId,
        payment_link_id: link.id,
        status: 'SUBMITTED',
        payer_amount_sent: params.payerAmountSent.trim(),
        payer_currency: params.payerCurrency?.trim() || null,
        payer_destination: params.payerDestination?.trim() || null,
        payer_payment_method_used: params.payerPaymentMethodUsed?.trim() || null,
        payer_reference: params.payerReference?.trim() || null,
        payer_proof_details: params.payerProofDetails?.trim() || null,
        payer_note: params.payerNote?.trim() || null,
        verification_status: verification.verification_status,
        match_confidence: verification.match_confidence,
        verification_issues: verification.verification_issues as Prisma.InputJsonValue,
      },
    });

    await tx.payment_links.update({
      where: { id: link.id },
      data: { status: 'PAID_UNVERIFIED', updated_at: new Date() },
    });
    if (nextStatus === 'REQUIRES_REVIEW') {
      await tx.payment_links.update({
        where: { id: link.id },
        data: { status: 'REQUIRES_REVIEW', updated_at: new Date() },
      });
    }

    await tx.payment_events.create({
      data: {
        id: randomUUID(),
        payment_link_id: link.id,
        event_type: 'PAYMENT_INITIATED',
        payment_method: 'MANUAL_BANK',
        amount_received: link.amount,
        currency_received: link.currency,
        source_type: 'MANUAL',
        source_reference: `manual_bank_submit:${confirmationId}`,
        metadata: {
          manual_bank_confirmation_id: confirmationId,
          submittedByPayer: true,
          newPaymentLinkStatus: nextStatus,
          verification_status: verification.verification_status,
          match_confidence: verification.match_confidence,
          verification_issues: verification.verification_issues,
          payerAmountSent: params.payerAmountSent,
          payerReference: params.payerReference || null,
          payerPaymentMethodUsed: params.payerPaymentMethodUsed || null,
        },
      },
    });

    try {
      await tx.notifications.create({
        data: {
          organization_id: link.organization_id,
          type: 'SYSTEM_ALERT',
          title: nextStatus === 'REQUIRES_REVIEW' ? 'Manual bank payment needs review' : 'Manual bank payment submitted',
          message:
            nextStatus === 'REQUIRES_REVIEW'
              ? `Invoice ${link.short_code}: payer submitted transfer details with mismatches. Review required.`
              : `Invoice ${link.short_code}: payer submitted manual bank transfer details for verification.`,
          data: {
            paymentLinkId: link.id,
            shortCode: link.short_code,
            confirmationId,
            status: nextStatus,
            match_confidence: verification.match_confidence,
            verification_issues: verification.verification_issues,
          },
        },
      });
    } catch (e) {
      log.warn({ err: e, paymentLinkId: link.id }, 'Could not create merchant notification for manual bank submit');
    }

    return {
      confirmationId,
      paymentLinkStatus: nextStatus,
      verification_status: verification.verification_status,
      match_confidence: verification.match_confidence,
      verification_issues: verification.verification_issues,
    };
  });
}

