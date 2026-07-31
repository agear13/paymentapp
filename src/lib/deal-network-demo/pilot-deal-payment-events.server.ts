/**
 * Deal Network pilot: explicit payment_events ↔ pilot deal linkage (additive).
 * Does not touch payment_links rows except optional pilot_deal_id on existing payment_events.
 */
import 'server-only';

import { randomUUID } from 'crypto';
import {
  PaymentEventRecordStatus,
  PaymentEventSourceType,
  Prisma,
} from '@prisma/client';
import { prisma } from '@/lib/server/prisma';

export async function getPilotDealForUser(userId: string, dealId: string) {
  return prisma.deal_network_pilot_deals.findFirst({
    where: { id: dealId, user_id: userId },
    select: { id: true, user_id: true },
  });
}

export async function createManualPilotDealPaymentEvent(params: {
  userId: string;
  dealId: string;
  amount: number;
  currency: string;
  sourceType: 'MANUAL' | 'CSV_IMPORT';
  sourceReference?: string | null;
  rawPayloadJson?: unknown;
  receivedAt?: Date | null;
}) {
  const logPrefix = '[deal-network-pilot/payment-events POST]';

  console.error(
    logPrefix,
    'createManualPilotDealPaymentEvent start',
    JSON.stringify({
      userId: params.userId,
      dealId: params.dealId,
      amount: params.amount,
      currency: params.currency,
      sourceType: params.sourceType,
      sourceReference: params.sourceReference ?? null,
      receivedAt: params.receivedAt?.toISOString() ?? null,
    }),
  );

  const deal = await getPilotDealForUser(params.userId, params.dealId);
  if (!deal) {
    console.error(
      logPrefix,
      'createManualPilotDealPaymentEvent deal lookup failed',
      JSON.stringify({
        userId: params.userId,
        dealId: params.dealId,
        validationResult: 'Deal not found',
      }),
    );
    return { ok: false as const, error: 'Deal not found' };
  }

  console.error(
    logPrefix,
    'createManualPilotDealPaymentEvent deal lookup ok',
    JSON.stringify({
      dealId: deal.id,
      dealUserId: deal.user_id,
    }),
  );

  const now = new Date();
  const receivedAt = params.receivedAt ?? now;
  const amt = new Prisma.Decimal(params.amount);
  const sourceType =
    params.sourceType === 'CSV_IMPORT'
      ? PaymentEventSourceType.CSV_IMPORT
      : PaymentEventSourceType.MANUAL;

  const createData = {
    id: randomUUID(),
    payment_link_id: null,
    pilot_deal_id: params.dealId,
    organization_id: null,
    event_type: 'PAYMENT_CONFIRMED' as const,
    payment_method: null,
    source_type: sourceType,
    source_reference: params.sourceReference?.trim() || null,
    gross_amount: amt,
    net_amount: null,
    amount_received: amt,
    currency_received: params.currency.toUpperCase().slice(0, 10),
    received_at: receivedAt,
    record_status: PaymentEventRecordStatus.RECORDED,
    raw_payload_json:
      params.rawPayloadJson === undefined || params.rawPayloadJson === null
        ? undefined
        : (params.rawPayloadJson as Prisma.InputJsonValue),
    metadata: {
      pilotUserId: params.userId,
      pilotDealId: params.dealId,
      createdVia: 'deal_network_pilot_manual',
    },
    correlation_id: `pilot_manual:${params.dealId}:${now.getTime()}`,
  };

  console.error(
    logPrefix,
    'before prisma.payment_events.create',
    JSON.stringify({
      dealId: params.dealId,
      userId: params.userId,
      prismaMutation: 'payment_events.create',
      data: {
        id: createData.id,
        pilot_deal_id: createData.pilot_deal_id,
        organization_id: createData.organization_id,
        event_type: createData.event_type,
        source_type: createData.source_type,
        gross_amount: createData.gross_amount.toString(),
        amount_received: createData.amount_received.toString(),
        currency_received: createData.currency_received,
        received_at: createData.received_at.toISOString(),
        record_status: createData.record_status,
        correlation_id: createData.correlation_id,
      },
    }),
  );

  let row;
  try {
    row = await prisma.payment_events.create({ data: createData });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      logPrefix,
      'prisma.payment_events.create threw',
      JSON.stringify({
        dealId: params.dealId,
        userId: params.userId,
        prismaMutation: 'payment_events.create',
        errorMessage: err.message,
        errorName: err.name,
        stack: err.stack,
      }),
    );
    throw error;
  }

  console.error(
    logPrefix,
    'after prisma.payment_events.create',
    JSON.stringify({
      dealId: params.dealId,
      userId: params.userId,
      paymentEventId: row.id,
      pilot_deal_id: row.pilot_deal_id,
    }),
  );

  return { ok: true as const, paymentEvent: row };
}

export async function linkPaymentEventToPilotDeal(params: {
  userId: string;
  dealId: string;
  paymentEventId: string;
}) {
  const deal = await getPilotDealForUser(params.userId, params.dealId);
  if (!deal) {
    return { ok: false as const, error: 'Deal not found' };
  }

  const existing = await prisma.payment_events.findUnique({
    where: { id: params.paymentEventId },
  });
  if (!existing) {
    return { ok: false as const, error: 'Payment event not found' };
  }
  if (existing.event_type !== 'PAYMENT_CONFIRMED') {
    return {
      ok: false as const,
      error: 'Only PAYMENT_CONFIRMED events can be linked as funding for a pilot deal',
    };
  }

  const updated = await prisma.payment_events.update({
    where: { id: params.paymentEventId },
    data: { pilot_deal_id: params.dealId },
  });

  return { ok: true as const, paymentEvent: updated };
}

export async function linkLatestConfirmedPaymentFromPaymentLinkToPilotDeal(params: {
  userId: string;
  dealId: string;
  paymentLinkId: string;
}) {
  const deal = await getPilotDealForUser(params.userId, params.dealId);
  if (!deal) {
    return { ok: false as const, error: 'Deal not found' };
  }

  const evt = await prisma.payment_events.findFirst({
    where: {
      payment_link_id: params.paymentLinkId,
      event_type: 'PAYMENT_CONFIRMED',
    },
    orderBy: [{ received_at: 'desc' }, { created_at: 'desc' }],
  });

  if (!evt) {
    return { ok: false as const, error: 'No PAYMENT_CONFIRMED event found for this payment link' };
  }

  return linkPaymentEventToPilotDeal({
    userId: params.userId,
    dealId: params.dealId,
    paymentEventId: evt.id,
  });
}
