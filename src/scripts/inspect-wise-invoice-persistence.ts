/**
 * Inspect how Wise context is persisted after invoice creation.
 *
 * Usage:
 *   tsx scripts/inspect-wise-invoice-persistence.ts [paymentLinkId|shortCode]
 *   tsx scripts/inspect-wise-invoice-persistence.ts --latest 5
 */

import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: '.env' });

const prisma = new PrismaClient();

type WiseEventMetadata = {
  wise_reference?: string;
  wise_profile_id_used?: string;
  wise_currency_used?: string;
  wise_payment_status?: string;
  wise_payment_details_snapshot?: {
    reference?: string;
    amount?: string;
    currency?: string;
    recipient?: { name?: string; accountDetails?: unknown[] };
    instructions?: { type?: string; details?: unknown };
  };
  wise_context_created_at?: string;
};

async function inspectLink(link: {
  id: string;
  short_code: string;
  payment_method: string | null;
  wise_status: string | null;
  wise_transfer_id: string | null;
  wise_quote_id: string | null;
  amount: unknown;
  currency: string;
  created_at: Date;
}) {
  const wiseEvent = await prisma.payment_events.findFirst({
    where: {
      payment_link_id: link.id,
      payment_method: 'WISE',
      event_type: 'PAYMENT_INITIATED',
    },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      event_type: true,
      payment_method: true,
      created_at: true,
      metadata: true,
    },
  });

  const meta = (wiseEvent?.metadata ?? null) as WiseEventMetadata | null;
  const snapshot = meta?.wise_payment_details_snapshot;
  const accountDetails = snapshot?.recipient?.accountDetails ?? [];
  const instructionDetails = snapshot?.instructions?.details;

  console.log('\n--- payment_links row ---');
  console.log({
    id: link.id,
    shortCode: link.short_code,
    paymentMethod: link.payment_method,
    amount: String(link.amount),
    currency: link.currency,
    wise_status: link.wise_status,
    wise_transfer_id: link.wise_transfer_id,
    wise_quote_id: link.wise_quote_id,
    createdAt: link.created_at.toISOString(),
  });

  console.log('\n--- PAYMENT_INITIATED (WISE) event ---');
  if (!wiseEvent) {
    console.log('MISSING — no WISE PAYMENT_INITIATED event (wiseContext was null at insert)');
    return;
  }

  console.log({
    eventId: wiseEvent.id,
    createdAt: wiseEvent.created_at.toISOString(),
    wise_reference: meta?.wise_reference ?? null,
    wise_profile_id_used: meta?.wise_profile_id_used ?? null,
    wise_currency_used: meta?.wise_currency_used ?? null,
    wise_payment_status: meta?.wise_payment_status ?? null,
    wise_context_created_at: meta?.wise_context_created_at ?? null,
    snapshotReference: snapshot?.reference ?? null,
    snapshotAmount: snapshot?.amount ?? null,
    snapshotCurrency: snapshot?.currency ?? null,
    recipientName: snapshot?.recipient?.name ?? null,
    accountDetailsCount: Array.isArray(accountDetails) ? accountDetails.length : 0,
    hasInstructionDetails: instructionDetails != null,
    instructionDetailsPreview: instructionDetails ?? null,
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--stats') {
    const [wiseMethod, wiseStatus, wiseEvents, latest] = await Promise.all([
      prisma.payment_links.count({ where: { payment_method: 'WISE' } }),
      prisma.payment_links.count({ where: { wise_status: { not: null } } }),
      prisma.payment_events.count({ where: { payment_method: 'WISE' } }),
      prisma.payment_links.findMany({
        orderBy: { created_at: 'desc' },
        take: 5,
        select: {
          short_code: true,
          payment_method: true,
          wise_status: true,
          created_at: true,
        },
      }),
    ]);
    console.log({ wiseMethodLinks: wiseMethod, linksWithWiseStatus: wiseStatus, wisePaymentEvents: wiseEvents });
    console.log('Latest payment links:', latest);
    return;
  }

  if (args[0] === '--latest') {
    const limit = Math.min(Number(args[1] || 3), 20);
    const links = await prisma.payment_links.findMany({
      where: { payment_method: 'WISE' },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        id: true,
        short_code: true,
        payment_method: true,
        wise_status: true,
        wise_transfer_id: true,
        wise_quote_id: true,
        amount: true,
        currency: true,
        created_at: true,
      },
    });

    if (links.length === 0) {
      console.log('No payment_links with payment_method=WISE found.');
      return;
    }

    console.log(`Inspecting ${links.length} latest WISE invoice(s)...`);
    for (const link of links) {
      await inspectLink(link);
    }
    return;
  }

  const identifier = args[0];
  if (!identifier) {
    console.error(
      'Usage:\n' +
        '  tsx scripts/inspect-wise-invoice-persistence.ts --latest [n]\n' +
        '  tsx scripts/inspect-wise-invoice-persistence.ts <paymentLinkId|shortCode>'
    );
    process.exit(1);
  }

  const link = await prisma.payment_links.findFirst({
    where: {
      OR: [{ id: identifier }, { short_code: identifier }],
    },
    select: {
      id: true,
      short_code: true,
      payment_method: true,
      wise_status: true,
      wise_transfer_id: true,
      wise_quote_id: true,
      amount: true,
      currency: true,
      created_at: true,
    },
  });

  if (!link) {
    console.error(`No payment link found for: ${identifier}`);
    process.exit(1);
  }

  await inspectLink(link);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
