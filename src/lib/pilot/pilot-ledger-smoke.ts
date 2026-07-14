import type { PrismaClient } from '@prisma/client';

/**
 * Lightweight ledger smoke checks safe for CLI scripts (no server-only imports).
 */
export async function runPilotLedgerSmokeCheck(prisma: PrismaClient): Promise<{
  ok: boolean;
  openWithConfirmed: number;
  paidWithoutConfirmed: number;
  duplicateConfirmed: number;
}> {
  const [openWithConfirmed, paidWithoutConfirmed, duplicateConfirmed] = await Promise.all([
    prisma.payment_links.count({
      where: {
        status: 'OPEN',
        payment_events: { some: { event_type: 'PAYMENT_CONFIRMED' } },
      },
    }),
    prisma.payment_links.count({
      where: {
        status: 'PAID',
        payment_events: { none: { event_type: 'PAYMENT_CONFIRMED' } },
      },
    }),
    prisma.payment_events.groupBy({
      by: ['payment_link_id'],
      where: { event_type: 'PAYMENT_CONFIRMED', payment_link_id: { not: null } },
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
    }).then((rows) => rows.length),
  ]);

  const ok =
    openWithConfirmed === 0 && paidWithoutConfirmed === 0 && duplicateConfirmed === 0;

  return { ok, openWithConfirmed, paidWithoutConfirmed, duplicateConfirmed };
}
