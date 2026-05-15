/**
 * Participant-owned referral codes (cross-org).
 * Visibility is by participant_user_id and/or checkout_config.participantEmail — not org membership.
 */

import { prisma } from '@/lib/server/prisma';
import { referralTrace } from '@/lib/referrals/referral-trace';

export type ParticipantReferralCodeRow = {
  id: string;
  code: string;
  slug: string | null;
  created_at: Date;
  referral_links: { slug: string | null };
};

const activeCodeWhere = {
  status: 'ACTIVE' as const,
  OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
};

function checkoutParticipantEmail(config: unknown): string | null {
  if (!config || typeof config !== 'object') return null;
  const raw = (config as { participantEmail?: unknown }).participantEmail;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed || null;
}

/**
 * Codes and email-bound links attributed to this participant, across all organizations.
 */
export async function loadReferralCodesForParticipant(params: {
  participantUserId: string;
  participantEmail?: string | null;
  bindUserOnEmailMatch?: boolean;
}): Promise<ParticipantReferralCodeRow[]> {
  const { participantUserId, bindUserOnEmailMatch = true } = params;
  const email = params.participantEmail?.trim().toLowerCase() || null;

  referralTrace('loadReferralCodesForParticipant.start', {
    scope: 'crossOrgParticipantOwnership',
    participantUserId,
    participantEmail: email,
    bindUserOnEmailMatch,
  });

  const byUser = await prisma.referral_codes.findMany({
    where: {
      participant_user_id: participantUserId,
      ...activeCodeWhere,
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

  const fromEmail: ParticipantReferralCodeRow[] = [];

  if (email) {
    const linksByEmail = await prisma.referral_links.findMany({
      where: {
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
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    for (const link of linksByEmail) {
      const rc = link.referral_code;
      if (!rc || rc.status !== 'ACTIVE') continue;
      if (rc.expires_at && rc.expires_at <= new Date()) continue;

      const configEmail = checkoutParticipantEmail(link.checkout_config);
      if (configEmail !== email) continue;

      if (bindUserOnEmailMatch && rc.participant_user_id !== participantUserId) {
        await prisma.referral_codes.update({
          where: { id: rc.id },
          data: { participant_user_id: participantUserId },
        });
        referralTrace('loadReferralCodesForParticipant.bindOnRead', {
          referralCodeId: rc.id,
          code: rc.code,
          participantUserId,
          previousParticipantUserId: rc.participant_user_id,
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

    referralTrace('loadReferralCodesForParticipant.emailPass', {
      email,
      linksMatched: linksByEmail.length,
      codesIncluded: fromEmail.length,
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
  const result = merged.slice(0, 50);

  referralTrace('loadReferralCodesForParticipant.done', {
    scope: 'crossOrgParticipantOwnership',
    byUserCount: byUser.length,
    byEmailCodeCount: fromEmail.length,
    mergedCount: result.length,
    codes: result.map((r) => r.code),
  });

  return result;
}
