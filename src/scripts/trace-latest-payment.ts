import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(__dirname, '../.env.local') });
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const eventTypeCounts = await prisma.payment_events.groupBy({
    by: ['event_type'],
    _count: true,
  });
  const paidLinks = await prisma.payment_links.findMany({
    where: { status: 'PAID' },
    orderBy: { updated_at: 'desc' },
    take: 5,
    select: {
      id: true,
      short_code: true,
      status: true,
      updated_at: true,
      created_at: true,
      referral_link_id: true,
      attributed_participant_user_id: true,
      pilot_deal_id: true,
    },
  });
  const recentAny = await prisma.payment_events.findMany({
    orderBy: { created_at: 'desc' },
    take: 5,
    select: {
      id: true,
      payment_link_id: true,
      event_type: true,
      created_at: true,
      amount_received: true,
    },
  });
  console.log(
    'DB_SCAN',
    JSON.stringify({ eventTypeCounts, paidLinksCount: paidLinks.length, paidLinks, recentAny }, null, 2)
  );

  const recent = await prisma.payment_events.findMany({
    where: { event_type: 'PAYMENT_CONFIRMED' },
    orderBy: { created_at: 'desc' },
    take: 5,
    select: {
      id: true,
      payment_link_id: true,
      created_at: true,
      amount_received: true,
      currency_received: true,
      payment_method: true,
    },
  });

  let evt = recent[0];
  if (!evt?.payment_link_id && paidLinks[0]) {
    const fallbackEvt = await prisma.payment_events.findFirst({
      where: { payment_link_id: paidLinks[0].id, event_type: 'PAYMENT_CONFIRMED' },
      orderBy: { created_at: 'desc' },
    });
    if (fallbackEvt) {
      evt = {
        id: fallbackEvt.id,
        payment_link_id: fallbackEvt.payment_link_id,
        created_at: fallbackEvt.created_at,
        amount_received: fallbackEvt.amount_received,
        currency_received: fallbackEvt.currency_received,
        payment_method: fallbackEvt.payment_method,
      };
    }
  }

  if (!evt?.payment_link_id) {
    console.log('NO_PAYMENT_CONFIRMED_EVENT');
    return;
  }

  const link = await prisma.payment_links.findUnique({
    where: { id: evt.payment_link_id },
    select: {
      id: true,
      short_code: true,
      referral_link_id: true,
      attributed_participant_user_id: true,
      commission_attribution_snapshot: true,
      pilot_deal_id: true,
      status: true,
      attribution_referral_code: true,
      amount: true,
      invoice_currency: true,
      created_at: true,
      updated_at: true,
    },
  });

  const fullEvt = await prisma.payment_events.findUnique({
    where: { id: evt.id },
  });

  const obligations = await prisma.commission_obligations.findMany({
    where: {
      OR: [{ payment_link_id: evt.payment_link_id }, { stripe_event_id: evt.id }],
    },
    include: { obligation_items: true, obligation_lines: true },
  });

  const pilotDealId = fullEvt?.pilot_deal_id ?? link?.pilot_deal_id ?? null;
  const pilotObligations = pilotDealId
    ? await prisma.deal_network_pilot_obligations.findMany({
        where: { deal_id: pilotDealId },
        orderBy: { updated_at: 'desc' },
        take: 30,
      })
    : [];

  const ledgerCommission = await prisma.ledger_entries.findMany({
    where: {
      payment_link_id: evt.payment_link_id,
      description: { contains: 'commission', mode: 'insensitive' },
    },
    take: 10,
    orderBy: { created_at: 'desc' },
    select: { id: true, description: true, amount: true, created_at: true },
  });

  console.log(
    JSON.stringify(
      {
        payment_event: fullEvt,
        payment_link: link,
        commission_obligations: obligations,
        pilot_deal_id: pilotDealId,
        deal_network_pilot_obligations: pilotObligations,
        ledger_commission_entries: ledgerCommission,
      },
      (_, v) => (typeof v === 'bigint' ? v.toString() : v),
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
