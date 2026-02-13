/**
 * Derives paid_at from payment_events (latest PAYMENT_CONFIRMED timestamp).
 * payment_links has no paid_at column; this is the canonical source.
 */

import type { PrismaClient } from '@prisma/client';

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
    select: { created_at: true },
  });
  return event?.created_at ?? null;
}
