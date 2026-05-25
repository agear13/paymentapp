import 'server-only';

import { prisma } from '@/lib/server/prisma';
import {
  orchestrateOperationalMutation,
} from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';

/**
 * Bridges invoice settlement (PAYMENT_CONFIRMED) into operational funding orchestration.
 * Runs after payment confirmation commits when a pilot deal is linked.
 */
export async function orchestrateFundingAfterInvoiceSettlement(
  paymentEventId: string
): Promise<void> {
  const event = await prisma.payment_events.findUnique({
    where: { id: paymentEventId },
    select: { pilot_deal_id: true, payment_link_id: true },
  });

  let pilotDealId = event?.pilot_deal_id ?? null;
  if (!pilotDealId && event?.payment_link_id) {
    const link = await prisma.payment_links.findUnique({
      where: { id: event.payment_link_id },
      select: { pilot_deal_id: true },
    });
    pilotDealId = link?.pilot_deal_id ?? null;
  }
  if (!pilotDealId) return;

  const deal = await prisma.deal_network_pilot_deals.findUnique({
    where: { id: pilotDealId },
    select: { id: true, user_id: true },
  });
  if (!deal?.user_id) return;

  await orchestrateOperationalMutation({
    userId: deal.user_id,
    mutation: 'funding_update',
    projectId: deal.id,
  });
}

/** Bridge manual invoice mark-paid when linked to a pilot project. */
export async function orchestrateFundingAfterManualInvoiceSettlement(
  paymentLinkId: string
): Promise<void> {
  const link = await prisma.payment_links.findUnique({
    where: { id: paymentLinkId },
    select: { pilot_deal_id: true },
  });
  if (!link?.pilot_deal_id) return;

  const deal = await prisma.deal_network_pilot_deals.findUnique({
    where: { id: link.pilot_deal_id },
    select: { id: true, user_id: true },
  });
  if (!deal?.user_id) return;

  await orchestrateOperationalMutation({
    userId: deal.user_id,
    mutation: 'funding_update',
    projectId: deal.id,
  });
}
