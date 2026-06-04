import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { isCompleteCommissionAttributionMetadata } from '@/lib/referrals/commission-attribution-snapshot';
import {
  coerceJsonToCommissionMetadata,
  extractReferralMetadata,
  parseReferralSplitsFromMetadata,
} from '@/lib/referrals/commission-posting';

export type CommissionPropagationLookupInput = {
  stripePaymentIntentId?: string;
  shortCode?: string;
  paymentLinkId?: string;
  paymentEventId?: string;
};

function firstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return undefined;
}

export async function lookupCommissionPropagationChain(input: CommissionPropagationLookupInput) {
  const stripePaymentIntentId = firstNonEmpty(input.stripePaymentIntentId);
  const shortCode = firstNonEmpty(input.shortCode);
  const paymentLinkId = firstNonEmpty(input.paymentLinkId);
  const paymentEventId = firstNonEmpty(input.paymentEventId);

  if (!stripePaymentIntentId && !shortCode && !paymentLinkId && !paymentEventId) {
    return { error: 'Provide stripePaymentIntentId, shortCode, paymentLinkId, or paymentEventId' as const };
  }

  const paymentEvent = paymentEventId
    ? await prisma.payment_events.findUnique({ where: { id: paymentEventId } })
    : stripePaymentIntentId
      ? await prisma.payment_events.findFirst({
          where: { stripe_payment_intent_id: stripePaymentIntentId },
          orderBy: { created_at: 'desc' },
        })
      : null;

  let link =
    paymentLinkId
      ? await prisma.payment_links.findUnique({ where: { id: paymentLinkId } })
      : shortCode
        ? await prisma.payment_links.findFirst({ where: { short_code: shortCode } })
        : paymentEvent?.payment_link_id
          ? await prisma.payment_links.findUnique({ where: { id: paymentEvent.payment_link_id } })
          : null;

  const resolvedEvent =
    paymentEvent ??
    (link
      ? await prisma.payment_events.findFirst({
          where: {
            payment_link_id: link.id,
            event_type: 'PAYMENT_CONFIRMED',
          },
          orderBy: { created_at: 'desc' },
        })
      : null);

  if (!resolvedEvent && !link) {
    return { error: 'No payment_events or payment_links row matched' as const };
  }

  if (!link && resolvedEvent?.payment_link_id) {
    link = await prisma.payment_links.findUnique({ where: { id: resolvedEvent.payment_link_id } });
  }

  const eventId = resolvedEvent?.id;
  const linkId = link?.id;

  const obligations =
    linkId || eventId
      ? await prisma.commission_obligations.findMany({
          where: {
            OR: [
              ...(linkId ? [{ payment_link_id: linkId }] : []),
              ...(eventId ? [{ stripe_event_id: eventId }] : []),
            ],
          },
          include: {
            obligation_items: true,
            obligation_lines: true,
          },
        })
      : [];

  const snapshotMd = coerceJsonToCommissionMetadata(link?.commission_attribution_snapshot ?? null);
  const eventMd = coerceJsonToCommissionMetadata(resolvedEvent?.metadata ?? null);
  const mergedMd = { ...(eventMd ?? {}), ...(snapshotMd ?? {}) } as Record<string, string>;
  const splits = parseReferralSplitsFromMetadata(mergedMd as never);
  const legacyMeta = extractReferralMetadata(mergedMd as never);

  const pilotDealId = resolvedEvent?.pilot_deal_id ?? link?.pilot_deal_id ?? null;
  const pilotObligations = pilotDealId
    ? await prisma.deal_network_pilot_obligations.findMany({
        where: { deal_id: pilotDealId },
        orderBy: { updated_at: 'desc' },
        take: 30,
      })
    : [];

  const participantUserId = link?.attributed_participant_user_id ?? null;
  const dashboardItems = linkId
    ? await prisma.commission_obligation_items.findMany({
        where: {
          commission_obligations: { payment_link_id: linkId },
        },
        take: 20,
      })
    : [];

  const propagationStops: string[] = [];

  if (!resolvedEvent || resolvedEvent.event_type !== 'PAYMENT_CONFIRMED') {
    propagationStops.push('NO_PAYMENT_CONFIRMED_EVENT');
  }
  if (!link?.referral_link_id) {
    propagationStops.push('PAYMENT_LINK_MISSING_REFERRAL_LINK_ID');
  }
  if (!isCompleteCommissionAttributionMetadata(mergedMd as never) && !splits?.length && !legacyMeta) {
    propagationStops.push('INCOMPLETE_COMMISSION_METADATA');
  }
  if (obligations.length === 0) {
    propagationStops.push('NO_COMMISSION_OBLIGATIONS_ROW');
  }
  if (obligations.length > 0 && obligations.every((o) => o.obligation_items.length === 0)) {
    propagationStops.push('NO_COMMISSION_OBLIGATION_ITEMS');
  }
  if (participantUserId && dashboardItems.length === 0 && obligations.length > 0) {
    propagationStops.push('PARTICIPANT_DASHBOARD_NO_ITEMS_FOR_ATTRIBUTED_USER');
  }
  if (!pilotDealId) {
    propagationStops.push('NO_PILOT_DEAL_ID_PROJECT_EARNINGS_UNCHANGED');
  }
  if (pilotDealId && pilotObligations.length === 0) {
    propagationStops.push('NO_DEAL_NETWORK_PILOT_OBLIGATIONS_ROWS');
  }

  const firstDivergence = propagationStops[0] ?? 'CHAIN_COMPLETE_OR_NOT_APPLICABLE';

  return {
    lookupKeysUsed: {
      stripePaymentIntentId: stripePaymentIntentId ?? null,
      shortCode: shortCode ?? null,
      paymentLinkId: paymentLinkId ?? null,
      paymentEventId: paymentEventId ?? null,
    },
    payment_event: resolvedEvent
      ? {
          id: resolvedEvent.id,
          payment_link_id: resolvedEvent.payment_link_id,
          event_type: resolvedEvent.event_type,
          payment_method: resolvedEvent.payment_method,
          amount_received: resolvedEvent.amount_received?.toString(),
          currency_received: resolvedEvent.currency_received,
          stripe_event_id: resolvedEvent.stripe_event_id,
          stripe_payment_intent_id: resolvedEvent.stripe_payment_intent_id,
          pilot_deal_id: resolvedEvent.pilot_deal_id,
          correlation_id: resolvedEvent.correlation_id,
          created_at: resolvedEvent.created_at,
        }
      : null,
    payment_link: link
      ? {
          id: link.id,
          short_code: link.short_code,
          status: link.status,
          referral_link_id: link.referral_link_id,
          referral_code_id: link.referral_code_id,
          attribution_referral_code: link.attribution_referral_code,
          attributed_participant_user_id: link.attributed_participant_user_id,
          attribution_source: link.attribution_source,
          pilot_deal_id: link.pilot_deal_id,
          commission_attribution_snapshot: link.commission_attribution_snapshot,
        }
      : null,
    commission_metadata_analysis: {
      snapshotComplete: isCompleteCommissionAttributionMetadata(snapshotMd as never),
      mergedComplete: isCompleteCommissionAttributionMetadata(mergedMd as never),
      hasSplits: Boolean(splits?.length),
      legacyMetaPresent: Boolean(legacyMeta),
    },
    commission_obligations: obligations.map((o) => ({
      id: o.id,
      payment_link_id: o.payment_link_id,
      referral_link_id: o.referral_link_id,
      stripe_event_id: o.stripe_event_id,
      status: o.status,
      consultant_amount: o.consultant_amount.toString(),
      bd_partner_amount: o.bd_partner_amount.toString(),
      currency: o.currency,
      items: o.obligation_items,
      lines: o.obligation_lines,
    })),
    participant_earnings_ui: {
      surface: 'GET /api/me/referral-dashboard (commission_obligation_items)',
      attributed_participant_user_id: participantUserId,
      itemsForThisPaymentLink: dashboardItems.length,
      items: dashboardItems,
      project_operator_surface:
        'deal_network_pilot_obligations via operational graph (requires pilot_deal_id + refresh)',
      pilot_deal_id: pilotDealId,
      pilot_obligation_rows: pilotObligations.length,
    },
    propagation_stops: propagationStops,
    first_divergence: firstDivergence,
  };
}
