/**
 * Wise webhook processing — reference-based correlation + confirmPayment.
 */

import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';
import { confirmPayment } from '@/lib/services/payment-confirmation';
import { isWiseAutoSettlementAvailable } from '@/lib/pilot/wise-auto-settlement';
import { fetchCustomerPaymentReferenceForTransfer } from '@/lib/wise/wise-balance-statement';
import {
  buildWiseTransferSettlementKey,
  correlateAccountDetailsPaymentStateChange,
  correlateSwiftInCreditEvent,
  correlateWiseBalanceCreditEvent,
  correlateWiseTransferStateChange,
  type WiseCorrelationResult,
  type WiseWebhookPayload,
} from '@/lib/wise/wise-incoming-payment-correlation';
import { parseProvvyPaymentReference } from '@/lib/wise/wise-payment-reference';

export type WiseWebhookProcessResult = {
  received: true;
  processed: boolean;
  reason?: string;
};

const PAYMENT_LINK_SELECT = {
  id: true,
  short_code: true,
  status: true,
  amount: true,
  currency: true,
  invoice_currency: true,
  payment_method: true,
  organization_id: true,
  wise_status: true,
} as const;

async function webhookDeliveryAlreadyProcessed(dedupKey: string): Promise<boolean> {
  const existing = await prisma.payment_events.findFirst({
    where: {
      OR: [
        { correlation_id: dedupKey },
        {
          metadata: {
            path: ['wise_webhook_dedup_key'],
            equals: dedupKey,
          },
        },
      ],
    },
    select: { id: true },
  });
  return Boolean(existing);
}

async function wiseTransferAlreadySettled(transferId: string): Promise<boolean> {
  const settlementKey = buildWiseTransferSettlementKey(transferId);
  const existing = await prisma.payment_events.findFirst({
    where: {
      OR: [
        { correlation_id: settlementKey },
        { wise_transfer_id: transferId },
        {
          metadata: {
            path: ['wiseTransferSettlementKey'],
            equals: settlementKey,
          },
        },
        { event_type: 'PAYMENT_CONFIRMED', wise_transfer_id: transferId },
      ],
    },
    select: { id: true },
  });
  return Boolean(existing);
}

async function recordWebhookReceipt(input: {
  paymentLinkId: string;
  dedupKey: string;
  payload: WiseWebhookPayload;
  correlation: Record<string, unknown>;
}): Promise<void> {
  await prisma.payment_events.create({
    data: {
      id: randomUUID(),
      payment_link_id: input.paymentLinkId,
      event_type: 'PAYMENT_PENDING',
      payment_method: 'WISE',
      correlation_id: input.dedupKey,
      metadata: {
        wise_webhook_dedup_key: input.dedupKey,
        wise_webhook_event_type: input.payload.event_type ?? null,
        wise_webhook_receipt: true,
        ...input.correlation,
      } as Prisma.InputJsonValue,
      created_at: new Date(),
    },
  });
}

async function loadPaymentLinkForTransfer(transferId: number) {
  return prisma.payment_links.findFirst({
    where: { wise_transfer_id: String(transferId) },
    select: PAYMENT_LINK_SELECT,
  });
}

async function loadPaymentLinkForReference(reference: string) {
  const shortCode = parseProvvyPaymentReference(reference);
  if (!shortCode) {
    return null;
  }
  return prisma.payment_links.findFirst({
    where: { short_code: shortCode },
    select: PAYMENT_LINK_SELECT,
  });
}

async function loadMerchantWiseProfile(organizationId: string) {
  return prisma.merchant_settings.findFirst({
    where: { organization_id: organizationId },
    select: {
      wise_profile_id: true,
      wise_enabled: true,
    },
  });
}

async function settleCorrelatedWisePayment(input: {
  correlation: Extract<WiseCorrelationResult, { status: 'correlated' }>;
  payload: WiseWebhookPayload;
  correlationId: string;
}): Promise<WiseWebhookProcessResult> {
  if (await wiseTransferAlreadySettled(input.correlation.wiseTransferId)) {
    log.info(
      { correlationId: input.correlationId, transferId: input.correlation.wiseTransferId },
      'Wise transfer already settled — skipping duplicate event'
    );
    return { received: true, processed: false, reason: 'duplicate_transfer_settlement' };
  }

  if (await webhookDeliveryAlreadyProcessed(input.correlation.webhookDedupKey)) {
    log.info(
      { correlationId: input.correlationId, dedupKey: input.correlation.webhookDedupKey },
      'Wise webhook duplicate delivery'
    );
    return { received: true, processed: false, reason: 'duplicate_event' };
  }

  await recordWebhookReceipt({
    paymentLinkId: input.correlation.paymentLinkId,
    dedupKey: input.correlation.webhookDedupKey,
    payload: input.payload,
    correlation: input.correlation.correlationMetadata,
  });

  const result = await confirmPayment({
    paymentLinkId: input.correlation.paymentLinkId,
    provider: 'wise',
    providerRef: input.correlation.providerRef,
    transactionId: input.correlation.transactionId,
    amountReceived: input.correlation.amountReceived,
    currencyReceived: input.correlation.currencyReceived,
    correlationId: input.correlation.providerRef,
    metadata: {
      ...input.correlation.correlationMetadata,
      wiseReference: input.correlation.reference,
      wiseAutoSettlement: true,
    },
  });

  if (!result.success) {
    throw new Error(result.error ?? 'Wise confirmPayment failed');
  }

  await prisma.payment_links.update({
    where: { id: input.correlation.paymentLinkId },
    data: {
      wise_status: 'PAID',
      wise_transfer_id: input.correlation.wiseTransferId,
      wise_received_amount: input.correlation.amountReceived,
      updated_at: new Date(),
    },
  });

  log.info(
    {
      correlationId: input.correlationId,
      paymentLinkId: input.correlation.paymentLinkId,
      shortCode: input.correlation.shortCode,
      reference: input.correlation.reference,
      wiseTransferId: input.correlation.wiseTransferId,
    },
    'Wise incoming payment confirmed'
  );

  return { received: true, processed: true };
}

function logCorrelationOutcome(
  correlationId: string,
  correlation: WiseCorrelationResult
): WiseWebhookProcessResult {
  if (correlation.status === 'ignored') {
    log.info({ correlationId, reason: correlation.reason }, 'Wise webhook ignored');
    return { received: true, processed: false, reason: correlation.reason };
  }
  log.warn(
    { correlationId, reason: correlation.reason, detail: correlation.detail },
    'Wise webhook rejected'
  );
  return { received: true, processed: false, reason: correlation.reason };
}

async function processAccountDetailsPaymentWebhook(
  payload: WiseWebhookPayload,
  correlationId: string
): Promise<WiseWebhookProcessResult> {
  const data = payload.data;
  const currentState = data?.current_state?.trim().toUpperCase();
  if (currentState !== 'COMPLETED') {
    return {
      received: true,
      processed: false,
      reason: `Payment state ${currentState ?? 'unknown'} not completed`,
    };
  }

  const transferId = data?.transfer?.id;
  if (transferId == null) {
    return { received: true, processed: false, reason: 'missing_transfer_id' };
  }

  if (await wiseTransferAlreadySettled(String(transferId))) {
    return { received: true, processed: false, reason: 'duplicate_transfer_settlement' };
  }

  const profileId = data?.resource?.profile_id;
  const balanceId = data?.resource?.id;
  const currency = data?.transfer?.currency ?? data?.currency;
  if (profileId == null || balanceId == null || !currency?.trim()) {
    return { received: true, processed: false, reason: 'missing_balance_statement_context' };
  }

  let customerPaymentReference: string | null = null;
  let statementFound = false;

  try {
    const statementLookup = await fetchCustomerPaymentReferenceForTransfer({
      profileId,
      balanceId,
      currency,
      transferId,
      occurredAt: data?.occurred_at ?? payload.sent_at ?? null,
    });
    customerPaymentReference = statementLookup.paymentReference;
    statementFound = Boolean(statementLookup.statementTransaction);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Balance statement lookup failed';
    log.error({ correlationId, transferId, error: message }, 'Wise balance statement fetch failed');
    return { received: true, processed: false, reason: 'balance_statement_fetch_failed' };
  }

  const paymentLink = customerPaymentReference
    ? await loadPaymentLinkForReference(customerPaymentReference)
    : null;
  const merchantProfile = paymentLink
    ? await loadMerchantWiseProfile(paymentLink.organization_id)
    : null;

  const correlation = correlateAccountDetailsPaymentStateChange({
    payload,
    customerPaymentReference,
    paymentLink,
    merchantProfile,
    statementFound,
  });

  if (correlation.status !== 'correlated') {
    return logCorrelationOutcome(correlationId, correlation);
  }

  return settleCorrelatedWisePayment({ correlation, payload, correlationId });
}

async function processSwiftInCreditWebhook(
  payload: WiseWebhookPayload,
  correlationId: string
): Promise<WiseWebhookProcessResult> {
  const transferId = payload.data?.action?.id;
  if (transferId != null && (await wiseTransferAlreadySettled(String(transferId)))) {
    return { received: true, processed: false, reason: 'duplicate_transfer_settlement' };
  }

  const customerReference = payload.data?.resource?.reference?.trim() ?? '';
  const paymentLink = customerReference
    ? await loadPaymentLinkForReference(customerReference)
    : null;
  const merchantProfile = paymentLink
    ? await loadMerchantWiseProfile(paymentLink.organization_id)
    : null;

  const correlation = correlateSwiftInCreditEvent({ payload, paymentLink, merchantProfile });

  if (correlation.status !== 'correlated') {
    return logCorrelationOutcome(correlationId, correlation);
  }

  return settleCorrelatedWisePayment({ correlation, payload, correlationId });
}

export async function processWiseWebhookPayload(
  payload: WiseWebhookPayload,
  correlationId: string
): Promise<WiseWebhookProcessResult> {
  if (!isWiseAutoSettlementAvailable()) {
    log.info({ correlationId }, 'Wise auto-settlement disabled — webhook ignored');
    return { received: true, processed: false, reason: 'auto_settlement_disabled' };
  }

  const eventType = payload.event_type?.trim() ?? '';

  if (eventType === 'account-details-payment#state-change') {
    return processAccountDetailsPaymentWebhook(payload, correlationId);
  }

  if (eventType === 'swift-in#credit') {
    return processSwiftInCreditWebhook(payload, correlationId);
  }

  if (eventType === 'balances#update') {
    const correlation = correlateWiseBalanceCreditEvent({ payload });
    return logCorrelationOutcome(correlationId, correlation);
  }

  if (eventType === 'transfers#state-change') {
    const transferId = payload.data?.resource?.id;
    if (transferId == null) {
      return { received: true, processed: false, reason: 'missing_transfer_id' };
    }

    if (await wiseTransferAlreadySettled(String(transferId))) {
      return { received: true, processed: false, reason: 'duplicate_transfer_settlement' };
    }

    const paymentLink = await loadPaymentLinkForTransfer(transferId);
    const correlation = correlateWiseTransferStateChange({ payload, paymentLink });

    if (correlation.status !== 'correlated') {
      return logCorrelationOutcome(correlationId, correlation);
    }

    return settleCorrelatedWisePayment({ correlation, payload, correlationId });
  }

  log.info({ correlationId, eventType }, 'Wise webhook event type not handled');
  return { received: true, processed: false, reason: `unhandled_event:${eventType}` };
}
