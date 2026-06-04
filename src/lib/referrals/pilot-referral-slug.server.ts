import 'server-only';

import { prisma } from '@/lib/server/prisma';

/** Matches ensure-referral-issuance pilotSlug — referral_links.slug encodes pilot participant id. */
export function pilotSlugFromParticipantId(sourceParticipantId: string): string {
  const compact = sourceParticipantId.replace(/-/g, '').slice(0, 40);
  return `pilot-${compact}`.slice(0, 64);
}

/**
 * Resolve pilot deal + owner user from a referral link slug (pilot-{participantId compact}).
 */
export async function resolvePilotDealFromReferralSlug(input: {
  slug: string;
  organizationId: string;
}): Promise<{ pilotDealId: string; userId: string; participantId: string } | null> {
  const slug = input.slug.trim();
  if (!slug.startsWith('pilot-')) return null;

  const participants = await prisma.deal_network_pilot_participants.findMany({
    where: {
      deal: {
        linked_payment_links: { some: { organization_id: input.organizationId } },
      },
    },
    select: {
      id: true,
      deal_id: true,
      deal: { select: { user_id: true } },
    },
  });

  const match = participants.find((p) => pilotSlugFromParticipantId(p.id) === slug);
  if (!match?.deal?.user_id) return null;

  return {
    pilotDealId: match.deal_id,
    userId: match.deal.user_id,
    participantId: match.id,
  };
}
