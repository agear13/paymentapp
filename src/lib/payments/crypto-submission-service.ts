/**
 * Record payer crypto submission: assisted verification + invoice PAID_UNVERIFIED / REQUIRES_REVIEW.
 * Payment Links manual crypto only — no merchant approval gate.
 */

import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';
import { verifyCryptoConfirmationInput } from '@/lib/payments/crypto-confirmation-verification';
import type { PaymentLinkStatus } from '@prisma/client';
import { statusAfterManualConfirmationVerification } from '@/lib/payments/payment-confirmation-lifecycle';

export type SubmitCryptoConfirmationParams = {
  paymentLinkId: string;
  shortCode: string;
  payerNetwork: string;
  payerAmountSent: string;
  payerWalletAddress: string;
  payerTxHash?: string | null;
  payerCurrency?: string | null;
};

export type SubmitCryptoConfirmationResult = {
  confirmationId: string;
  paymentLinkStatus: PaymentLinkStatus;
  verification_status: string;
  match_confidence: string;
  verification_issues: string[];
};

export async function submitCryptoPaymentConfirmation(
  params: SubmitCryptoConfirmationParams
): Promise<SubmitCryptoConfirmationResult> {
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

    if (link.invoice_only_mode || link.payment_method !== 'CRYPTO') {
      throw new Error('Crypto submission is not available for this invoice');
    }

    const fullVerification = verifyCryptoConfirmationInput({
      merchantNetwork: link.crypto_network,
      merchantCryptoCurrency: link.crypto_currency,
      invoiceAmount: Number(link.amount),
      invoiceCurrency: link.currency,
      payerNetwork: params.payerNetwork,
      payerAmountSent: params.payerAmountSent,
      payerWalletAddress: params.payerWalletAddress,
      payerCurrency: params.payerCurrency,
      payerTxHash: params.payerTxHash,
    });

    const nextStatus = statusAfterManualConfirmationVerification({
      verification_status: fullVerification.verification_status,
      match_confidence: fullVerification.match_confidence,
    });

    const confirmationId = randomUUID();

    await tx.crypto_payment_confirmations.create({
      data: {
        id: confirmationId,
        payment_link_id: link.id,
        status: 'SUBMITTED',
        payer_network: params.payerNetwork.trim(),
        payer_amount_sent: params.payerAmountSent.trim(),
        payer_wallet_address: params.payerWalletAddress.trim(),
        payer_currency: params.payerCurrency?.trim() || null,
        payer_tx_hash: params.payerTxHash?.trim() || null,
        verification_status: fullVerification.verification_status,
        match_confidence: fullVerification.match_confidence,
        verification_issues: fullVerification.verification_issues as Prisma.InputJsonValue,
      },
    });

    await tx.payment_links.update({
      where: { id: link.id },
      data: {
        status: 'PAID_UNVERIFIED',
        updated_at: new Date(),
      },
    });
    if (nextStatus === 'REQUIRES_REVIEW') {
      await tx.payment_links.update({
        where: { id: link.id },
        data: {
          status: 'REQUIRES_REVIEW',
          updated_at: new Date(),
        },
      });
    }

    const correlationId = `crypto_submit:${confirmationId}`;

    await tx.payment_events.create({
      data: {
        id: randomUUID(),
        payment_link_id: link.id,
        event_type: 'CRYPTO_PAYMENT_SUBMITTED',
        payment_method: 'CRYPTO',
        pilot_deal_id: (link as { pilot_deal_id?: string | null }).pilot_deal_id ?? undefined,
        amount_received: link.amount,
        currency_received: link.currency,
        correlation_id: correlationId,
        metadata: {
          crypto_confirmation_id: confirmationId,
          verification_status: fullVerification.verification_status,
          match_confidence: fullVerification.match_confidence,
          verification_issues: fullVerification.verification_issues,
          newPaymentLinkStatus: nextStatus,
        },
      },
    });

    try {
      await tx.notifications.create({
        data: {
          organization_id: link.organization_id,
          type: 'SYSTEM_ALERT',
          title:
            nextStatus === 'REQUIRES_REVIEW'
              ? 'Crypto payment needs review'
              : 'Crypto payment submitted',
          message:
            nextStatus === 'REQUIRES_REVIEW'
              ? `Invoice ${link.short_code}: payer submitted crypto with flagged checks. Open Payment Links to review.`
              : `Invoice ${link.short_code}: payer submitted a crypto payment (automated checks passed).`,
          data: {
            paymentLinkId: link.id,
            shortCode: link.short_code,
            confirmationId,
            status: nextStatus,
            match_confidence: fullVerification.match_confidence,
          },
        },
      });
    } catch (e) {
      log.warn('Could not create merchant notification for crypto submit', {
        err: e instanceof Error ? e.message : String(e),
        paymentLinkId: link.id,
      });
    }

    log.info('Crypto payment confirmation recorded', {
      paymentLinkId: link.id,
      confirmationId,
      nextStatus,
      match_confidence: fullVerification.match_confidence,
    });

    return {
      confirmationId,
      paymentLinkStatus: nextStatus,
      verification_status: fullVerification.verification_status,
      match_confidence: fullVerification.match_confidence,
      verification_issues: fullVerification.verification_issues,
    };
  });
}
