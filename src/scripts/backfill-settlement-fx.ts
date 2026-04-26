/**
 * Backfill SETTLEMENT fx_snapshots for paid links that lack one.
 *
 * Targets: payment_links with status IN ('PAID','PARTIALLY_REFUNDED','REFUNDED')
 * that have no fx_snapshots row for (payment_link_id, SETTLEMENT, currency, currency).
 * Inserts one row per such link with rate=1, provider='BACKFILL'.
 * Idempotent: safe to run multiple times; skips links that already have the snapshot.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-settlement-fx.ts
 */

import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';

const STATUSES = ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] as const;

async function backfillSettlementFx() {
  log.info('Backfill SETTLEMENT fx_snapshots: starting');
  const links = await prisma.payment_links.findMany({
    where: { status: { in: [...STATUSES] } },
    select: { id: true, currency: true, status: true },
  });
  log.info('Backfill: found paid/refunded links', { count: links.length });
  let created = 0;
  let skipped = 0;
  for (const link of links) {
    const currency = (link.currency ?? '').trim().toUpperCase();
    if (!currency || currency.length < 3) {
      skipped++;
      continue;
    }
    const existing = await prisma.fx_snapshots.findFirst({
      where: {
        payment_link_id: link.id,
        snapshot_type: 'SETTLEMENT',
        base_currency: currency,
        quote_currency: currency,
      },
    });
    if (existing) {
      skipped++;
      continue;
    }
    try {
      await prisma.fx_snapshots.create({
        data: {
          payment_link_id: link.id,
          snapshot_type: 'SETTLEMENT',
          token_type: null,
          base_currency: currency,
          quote_currency: currency,
          rate: 1,
          provider: 'BACKFILL',
          captured_at: new Date(),
        },
      });
      created++;
      log.info('Backfill: created SETTLEMENT fx snapshot', {
        paymentLinkId: link.id,
        currency,
        status: link.status,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('unique') || message.includes('Unique constraint')) {
        skipped++;
        continue;
      }
      log.error('Backfill: failed to create snapshot', undefined, {
        paymentLinkId: link.id,
        error: message,
      });
    }
  }
  log.info('Backfill SETTLEMENT fx_snapshots: done', {
    created,
    skipped,
    total: links.length,
  });
  return { created, skipped, total: links.length };
}

backfillSettlementFx()
  .then((r) => {
    console.log('Result:', r);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
