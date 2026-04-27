/**
 * Derives paid_at from payment_events (latest PAYMENT_CONFIRMED timestamp).
 * payment_links has no paid_at column; this is the canonical source.
 */

import type { PrismaClient } from '@prisma/client';

type PaymentEventWithTimestamps = {
  event_type?: string | null;
  created_at?: Date | null;
  received_at?: Date | null;
};

/**
 * Get the paid_at timestamp for a payment link from the latest PAYMENT_CONFIRMED event.
 * @returns created_at of the latest PAYMENT_CONFIRMED event, or null if none exists
 */
export async function getPaidAtForPaymentLink(
  prisma: PrismaClient,
  paymentLinkId: string
): Promise<Date | null> {
  const event = await prisma.payment_events.findFirst({
    where: { payment_link_id: paymentLinkId, event_type: 'PAYMENT_CONFIRMED' },
    orderBy: { created_at: 'desc' },
    select: { created_at: true, received_at: true },
  });
  return event?.received_at ?? event?.created_at ?? null;
}

/**
 * Derive paid timestamp from in-memory events.
 * Authoritative timestamp: PAYMENT_CONFIRMED.received_at, fallback to created_at.
 */
export function derivePaidAtFromEvents(events: PaymentEventWithTimestamps[] | null | undefined): Date | null {
  if (!events?.length) return null;
  const confirmed = events.find((event) => event.event_type === 'PAYMENT_CONFIRMED');
  if (!confirmed) return null;
  return confirmed.received_at ?? confirmed.created_at ?? null;
}
