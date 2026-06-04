import 'server-only';

import { prisma } from '@/lib/server/prisma';
import {
  orchestrateOperationalMutation,
} from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';
import { commissionPropagationTrace } from '@/lib/referrals/commission-propagation-trace';
import { resolvePilotDealFromReferralSlug } from '@/lib/referrals/pilot-referral-slug.server';

export type PilotDealSettlementContext = {
  pilotDealId: string;
  userId: string;
};

/**
 * Resolve pilot project for settlement orchestration (payment_events / payment_links / referral slug).
 */
export async function resolvePilotDealContextForSettlement(input: {
  paymentEventId: string;
}): Promise<PilotDealSettlementContext | null> {
  const event = await prisma.payment_events.findUnique({
    where: { id: input.paymentEventId },
    select: { pilot_deal_id: true, payment_link_id: true },
  });
  if (!event) return null;

  let pilotDealId = event.pilot_deal_id ?? null;
  let organizationId: string | null = null;
  let referralSlug: string | null = null;

  if (event.payment_link_id) {
    const link = await prisma.payment_links.findUnique({
      where: { id: event.payment_link_id },
      select: {
        pilot_deal_id: true,
        organization_id: true,
        referral_link_id: true,
        commission_referral_link: { select: { slug: true } },
      },
    });
    if (!pilotDealId) pilotDealId = link?.pilot_deal_id ?? null;
    organizationId = link?.organization_id ?? null;
    referralSlug = link?.commission_referral_link?.slug ?? null;
  }

  if (!pilotDealId && organizationId && referralSlug) {
    const fromSlug = await resolvePilotDealFromReferralSlug({
      slug: referralSlug,
      organizationId,
    });
    if (fromSlug) {
      pilotDealId = fromSlug.pilotDealId;
      const deal = await prisma.deal_network_pilot_deals.findUnique({
        where: { id: pilotDealId },
        select: { user_id: true },
      });
      if (deal?.user_id) {
        return { pilotDealId, userId: deal.user_id };
      }
    }
  }

  if (!pilotDealId) return null;

  const deal = await prisma.deal_network_pilot_deals.findUnique({
    where: { id: pilotDealId },
    select: { id: true, user_id: true },
  });
  if (!deal?.user_id) return null;

  return { pilotDealId: deal.id, userId: deal.user_id };
}

/**
 * Bridges invoice settlement (PAYMENT_CONFIRMED) into operational funding orchestration.
 * Runs after payment confirmation commits when a pilot deal is linked.
 */
export async function orchestrateFundingAfterInvoiceSettlement(
  paymentEventId: string
): Promise<void> {
  const ctx = await resolvePilotDealContextForSettlement({ paymentEventId });
  if (!ctx) {
    const event = await prisma.payment_events.findUnique({
      where: { id: paymentEventId },
      select: { payment_link_id: true },
    });
    commissionPropagationTrace('funding_orchestration_skipped_no_pilot_deal', {
      paymentEventId,
      paymentLinkId: event?.payment_link_id ?? null,
    });
    return;
  }

  commissionPropagationTrace('funding_orchestration_started', {
    paymentEventId,
    pilotDealId: ctx.pilotDealId,
  });

  await orchestrateOperationalMutation({
    userId: ctx.userId,
    mutation: 'funding_update',
    projectId: ctx.pilotDealId,
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
