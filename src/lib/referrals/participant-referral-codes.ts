/**
 * Load referral codes visible to a participant (user id + email-bound pilot issuance).
 */

import { prisma } from '@/lib/server/prisma';

export type ParticipantReferralCodeRow = {
  id: string;
  code: string;
  slug: string | null;
  created_at: Date;
  referral_links: { slug: string | null };
};

export async function loadReferralCodesForParticipant(params: {
  organizationId: string;
  participantUserId: string;
  participantEmail?: string | null;
  bindUserOnEmailMatch?: boolean;
}): Promise<ParticipantReferralCodeRow[]> {
  const { organizationId, participantUserId, bindUserOnEmailMatch = true } = params;
  const email = params.participantEmail?.trim().toLowerCase() || null;

  const byUser = await prisma.referral_codes.findMany({
    where: {
      organization_id: organizationId,
      participant_user_id: participantUserId,
      status: 'ACTIVE',
      OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
    },
    orderBy: { created_at: 'desc' },
    take: 50,
    select: {
      id: true,
      code: true,
      slug: true,
      created_at: true,
      referral_links: { select: { slug: true } },
    },
  });

  if (!email) return byUser;

  const linksByEmail = await prisma.referral_links.findMany({
    where: {
      organization_id: organizationId,
      checkout_config: {
        path: ['participantEmail'],
        equals: email,
      },
    },
    include: {
      referral_code: {
        select: {
          id: true,
          code: true,
          slug: true,
          created_at: true,
          participant_user_id: true,
          status: true,
          expires_at: true,
        },
      },
    },
    take: 20,
  });

  const fromEmail: ParticipantReferralCodeRow[] = [];
  for (const link of linksByEmail) {
    const rc = link.referral_code;
    if (!rc || rc.status !== 'ACTIVE') continue;
    if (rc.expires_at && rc.expires_at <= new Date()) continue;

    if (bindUserOnEmailMatch && !rc.participant_user_id) {
      await prisma.referral_codes.update({
        where: { id: rc.id },
        data: { participant_user_id: participantUserId },
      });
    }

    fromEmail.push({
      id: rc.id,
      code: rc.code,
      slug: rc.slug,
      created_at: rc.created_at,
      referral_links: { slug: link.slug },
    });
  }

  const seen = new Set<string>();
  const merged: ParticipantReferralCodeRow[] = [];
  for (const row of [...byUser, ...fromEmail]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  merged.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  return merged.slice(0, 50);
}
