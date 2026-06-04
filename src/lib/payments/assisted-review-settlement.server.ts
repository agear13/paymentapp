/**
 * R3: Assisted bank/crypto review approval → canonical confirmPayment().
 *
 * Provider reference format (idempotency + source_reference):
 *   bank-review:{confirmationId}
 *   crypto-review:{confirmationId}
 */
import 'server-only';

import type { PaymentLinkStatus } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import {
  confirmPayment,
  type ConfirmPaymentResult,
} from '@/lib/services/payment-confirmation';
import { assistedReviewSettlementTrace } from '@/lib/payments/assisted-review-settlement-trace';

export type AssistedReviewRail = 'MANUAL_BANK' | 'CRYPTO';

/** Statuses from which mark_valid may invoke settlement (not OPEN — use R1 manual settlement). */
export const ASSISTED_REVIEW_SETTLEMENT_ENTRY_STATUSES: PaymentLinkStatus[] = [
  'PAID_UNVERIFIED',
  'REQUIRES_REVIEW',
];

export function bankReviewProviderRef(confirmationId: string): string {
  return `bank-review:${confirmationId}`;
}

export function cryptoReviewProviderRef(confirmationId: string): string {
  return `crypto-review:${confirmationId}`;
}

export function assistedReviewProviderRef(
  rail: AssistedReviewRail,
  confirmationId: string
): string {
  return rail === 'MANUAL_BANK'
    ? bankReviewProviderRef(confirmationId)
    : cryptoReviewProviderRef(confirmationId);
}

function settlementStagePrefix(rail: AssistedReviewRail): 'bank' | 'crypto' {
  return rail === 'MANUAL_BANK' ? 'bank' : 'crypto';
}

async function linkEligibleForAssistedReview(
  paymentLinkId: string,
  status: PaymentLinkStatus
): Promise<boolean> {
  if (ASSISTED_REVIEW_SETTLEMENT_ENTRY_STATUSES.includes(status)) {
    return true;
  }
  if (status === 'PAID') {
    const confirmed = await prisma.payment_events.findFirst({
      where: {
        payment_link_id: paymentLinkId,
        event_type: 'PAYMENT_CONFIRMED',
      },
      select: { id: true },
    });
    return !confirmed;
  }
  return false;
}

/**
 * Merchant mark_valid on assisted bank/crypto confirmation → confirmPayment (manual clearing rail).
 */
export async function executeAssistedReviewSettlement(params: {
  confirmationId: string;
  rail: AssistedReviewRail;
  actorUserId: string;
}): Promise<ConfirmPaymentResult> {
  const prefix = settlementStagePrefix(params.rail);
  const startedStage =
    prefix === 'bank' ? 'bank_review_settlement_started' : 'crypto_review_settlement_started';
  const completedStage =
    prefix === 'bank' ? 'bank_review_settlement_completed' : 'crypto_review_settlement_completed';
  const failedStage =
    prefix === 'bank' ? 'bank_review_settlement_failed' : 'crypto_review_settlement_failed';

  const providerRef = assistedReviewProviderRef(params.rail, params.confirmationId);

  try {
    if (params.rail === 'MANUAL_BANK') {
      const confirmation = await prisma.manual_bank_payment_confirmations.findUnique({
        where: { id: params.confirmationId },
        include: { payment_links: true },
      });

      if (!confirmation) {
        return { success: false, error: 'Confirmation not found' };
      }
      if (confirmation.status !== 'SUBMITTED') {
        const existingEvent = await prisma.payment_events.findFirst({
          where: {
            payment_link_id: confirmation.payment_link_id,
            event_type: 'PAYMENT_CONFIRMED',
          },
          select: { id: true },
        });
        if (existingEvent) {
          return {
            success: true,
            alreadyProcessed: true,
            paymentEventId: existingEvent.id,
          };
        }
        return { success: false, error: 'Only submitted confirmations support mark valid' };
      }

      const link = confirmation.payment_links;
      if (link.payment_method !== 'MANUAL_BANK') {
        return { success: false, error: 'Not a manual bank invoice' };
      }

      const eligible = await linkEligibleForAssistedReview(link.id, link.status);
      if (!eligible) {
        return {
          success: false,
          error: 'Invoice is not in a state that can be settled from review approval',
        };
      }

      assistedReviewSettlementTrace(startedStage, {
        confirmationId: params.confirmationId,
        paymentLinkId: link.id,
        providerRef,
        priorStatus: link.status,
        actorUserId: params.actorUserId,
        rail: params.rail,
      });

      const amountReceived = Number(link.amount);
      if (!Number.isFinite(amountReceived) || amountReceived <= 0) {
        return { success: false, error: 'Invoice amount must be a positive number' };
      }

      const currencyReceived = String(link.invoice_currency ?? link.currency).toUpperCase();

      const result = await confirmPayment({
        paymentLinkId: link.id,
        provider: 'manual',
        providerRef,
        amountReceived,
        currencyReceived,
        metadata: {
          actorUserId: params.actorUserId,
          confirmationId: params.confirmationId,
          rail: params.rail,
          settlementPath: 'assisted_review',
          source: 'manual-bank-confirmation-review',
          reason: 'merchant_mark_valid',
          payerAmountSent: confirmation.payer_amount_sent,
          payerReference: confirmation.payer_reference,
          verification_status: confirmation.verification_status,
          match_confidence: confirmation.match_confidence,
          ...(link.pilot_deal_id ? { pilot_deal_id: link.pilot_deal_id } : {}),
        },
      });

      if (!result.success) {
        assistedReviewSettlementTrace(failedStage, {
          confirmationId: params.confirmationId,
          paymentLinkId: link.id,
          providerRef,
          error: result.error,
        });
        return result;
      }

      assistedReviewSettlementTrace(completedStage, {
        confirmationId: params.confirmationId,
        paymentLinkId: link.id,
        providerRef,
        paymentEventId: result.paymentEventId,
        alreadyProcessed: result.alreadyProcessed,
      });

      return result;
    }

    const confirmation = await prisma.crypto_payment_confirmations.findUnique({
      where: { id: params.confirmationId },
      include: { payment_links: true },
    });

    if (!confirmation) {
      return { success: false, error: 'Confirmation not found' };
    }
    if (confirmation.status !== 'SUBMITTED') {
      const existingEvent = await prisma.payment_events.findFirst({
        where: {
          payment_link_id: confirmation.payment_link_id,
          event_type: 'PAYMENT_CONFIRMED',
        },
        select: { id: true },
      });
      if (existingEvent) {
        return {
          success: true,
          alreadyProcessed: true,
          paymentEventId: existingEvent.id,
        };
      }
      return { success: false, error: 'Only submitted confirmations support mark valid' };
    }

    const link = confirmation.payment_links;
    if (link.payment_method !== 'CRYPTO') {
      return { success: false, error: 'Not a crypto invoice' };
    }

    const eligible = await linkEligibleForAssistedReview(link.id, link.status);
    if (!eligible) {
      return {
        success: false,
        error: 'Invoice is not in a state that can be settled from review approval',
      };
    }

    assistedReviewSettlementTrace(startedStage, {
      confirmationId: params.confirmationId,
      paymentLinkId: link.id,
      providerRef,
      priorStatus: link.status,
      actorUserId: params.actorUserId,
      rail: params.rail,
      payerTxHash: confirmation.payer_tx_hash,
    });

    const amountReceived = Number(link.amount);
    if (!Number.isFinite(amountReceived) || amountReceived <= 0) {
      return { success: false, error: 'Invoice amount must be a positive number' };
    }

    const currencyReceived = String(link.invoice_currency ?? link.currency).toUpperCase();

    const result = await confirmPayment({
      paymentLinkId: link.id,
      provider: 'manual',
      providerRef,
      amountReceived,
      currencyReceived,
      metadata: {
        actorUserId: params.actorUserId,
        confirmationId: params.confirmationId,
        rail: params.rail,
        settlementPath: 'assisted_review',
        source: 'crypto-confirmation-review',
        reason: 'merchant_mark_valid',
        payerAmountSent: confirmation.payer_amount_sent,
        payerNetwork: confirmation.payer_network,
        payerTxHash: confirmation.payer_tx_hash,
        verification_status: confirmation.verification_status,
        match_confidence: confirmation.match_confidence,
        ...(link.pilot_deal_id ? { pilot_deal_id: link.pilot_deal_id } : {}),
      },
    });

    if (!result.success) {
      assistedReviewSettlementTrace(failedStage, {
        confirmationId: params.confirmationId,
        paymentLinkId: link.id,
        providerRef,
        error: result.error,
      });
      return result;
    }

    assistedReviewSettlementTrace(completedStage, {
      confirmationId: params.confirmationId,
      paymentLinkId: link.id,
      providerRef,
      paymentEventId: result.paymentEventId,
      alreadyProcessed: result.alreadyProcessed,
    });

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    assistedReviewSettlementTrace(failedStage, {
      confirmationId: params.confirmationId,
      providerRef,
      error: message,
    });
    return { success: false, error: message };
  }
}
