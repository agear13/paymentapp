/**
 * Strait / project_mode: aggregate inbound payment activity linked to a pilot deal
 * via payment_events.pilot_deal_id (coordination layer only).
 */
import 'server-only';

import { PaymentEventRecordStatus } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';

const FUNDING_EVENT_TYPES = ['PAYMENT_CONFIRMED', 'CRYPTO_PAYMENT_SUBMITTED', 'PAYMENT_INITIATED'] as const;

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Sum recorded amounts on pilot-linked payment events (non-voided). */
export async function sumPilotFundingForDeal(pilotDealId: string): Promise<number> {
  const rows = await prisma.payment_events.findMany({
    where: {
      pilot_deal_id: pilotDealId,
      event_type: { in: [...FUNDING_EVENT_TYPES] },
      OR: [{ record_status: null }, { record_status: { not: PaymentEventRecordStatus.VOIDED } }],
    },
    select: {
      amount_received: true,
      gross_amount: true,
    },
  });
  let sum = 0;
  for (const r of rows) {
    const a = toNumber(r.amount_received);
    const g = toNumber(r.gross_amount);
    sum += a > 0 ? a : g > 0 ? g : 0;
  }
  return Math.round(sum * 100) / 100;
}

export type ProjectFundingTier = 'UNFUNDED' | 'PARTIALLY_FUNDED' | 'FUNDED';

export function projectFundingTierFromAmounts(funded: number, owed: number): ProjectFundingTier {
  if (!Number.isFinite(owed) || owed <= 0) {
    return funded > 0 ? 'FUNDED' : 'UNFUNDED';
  }
  if (funded <= 0) return 'UNFUNDED';
  if (funded + 0.01 >= owed) return 'FUNDED';
  return 'PARTIALLY_FUNDED';
}

/** Count of payment link invoices linked to this pilot deal. */
export async function countLinkedPilotInvoices(pilotDealId: string): Promise<number> {
  return prisma.payment_links.count({
    where: { pilot_deal_id: pilotDealId },
  });
}

/** Latest PAYMENT_CONFIRMED event id for this pilot deal (obligation anchor). */
export async function primaryConfirmedFundingEventIdForDeal(dealId: string): Promise<string | null> {
  const evt = await prisma.payment_events.findFirst({
    where: {
      pilot_deal_id: dealId,
      event_type: 'PAYMENT_CONFIRMED',
      OR: [{ record_status: null }, { record_status: { not: PaymentEventRecordStatus.VOIDED } }],
    },
    orderBy: [{ received_at: 'desc' }, { created_at: 'desc' }],
    select: { id: true },
  });
  return evt?.id ?? null;
}

/**
 * Prefer PAYMENT_CONFIRMED for obligation.payment_event_id; if none yet, use latest
 * pilot-linked inbound activity row (coordination-only anchor).
 */
export async function fundingAnchorPaymentEventIdForDeal(dealId: string): Promise<string | null> {
  const confirmed = await primaryConfirmedFundingEventIdForDeal(dealId);
  if (confirmed) return confirmed;
  const evt = await prisma.payment_events.findFirst({
    where: {
      pilot_deal_id: dealId,
      event_type: { in: [...FUNDING_EVENT_TYPES] },
      OR: [{ record_status: null }, { record_status: { not: PaymentEventRecordStatus.VOIDED } }],
    },
    orderBy: [{ received_at: 'desc' }, { created_at: 'desc' }],
    select: { id: true },
  });
  return evt?.id ?? null;
}

/** Strait Experiences project pipeline (used server-side to scope funding math; referral deals omit AUD marker). */
export function isStraitProjectDeal(deal: { projectValueCurrency?: 'AUD' | 'USD' }): boolean {
  return deal.projectValueCurrency === 'AUD';
}

/** Sum amount_owed from latest obligation snapshot for this deal (read-only cache). */
export async function sumObligationsAmountForDeal(userId: string, dealId: string): Promise<number> {
  const agg = await prisma.deal_network_pilot_obligations.aggregate({
    where: { user_id: userId, deal_id: dealId },
    _sum: { amount_owed: true },
  });
  return toNumber(agg._sum.amount_owed);
}
