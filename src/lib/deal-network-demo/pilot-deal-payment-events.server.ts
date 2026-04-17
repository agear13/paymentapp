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
  const deal = await getPilotDealForUser(params.userId, params.dealId);
  if (!deal) {
    return { ok: false as const, error: 'Deal not found' };
  }

  const now = new Date();
  const receivedAt = params.receivedAt ?? now;
  const amt = new Prisma.Decimal(params.amount);
  const sourceType =
    params.sourceType === 'CSV_IMPORT'
      ? PaymentEventSourceType.CSV_IMPORT
      : PaymentEventSourceType.MANUAL;

  const row = await prisma.payment_events.create({
    data: {
      id: randomUUID(),
      payment_link_id: null,
      pilot_deal_id: params.dealId,
      organization_id: null,
      event_type: 'PAYMENT_CONFIRMED',
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
    },
  });

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
