/**
 * Idempotent referral link + code issuance after participant approval.
 * Reuses existing active rows; never regenerates codes.
 */

import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildReferralShareUrl } from '@/lib/referrals/referral-share-url';
import { log } from '@/lib/logger';
import type { CommissionStructureKind } from '@/lib/deal-network-demo/commission-structure';

export type EnsureReferralIssuanceInput = {
  organizationId: string;
  operatorUserId: string;
  participantUserId?: string | null;
  participantEmail?: string | null;
  participantName?: string | null;
  /** Stable id for idempotency (e.g. pilot participant row id). */
  sourceParticipantId: string;
  /** Optional Supabase referral_participants.referral_code */
  referralCodeHint?: string | null;
  commissionKind?: CommissionStructureKind;
  commissionValue?: number;
  projectLabel?: string | null;
};

export type EnsureReferralIssuanceResult = {
  referralLinkId: string;
  referralCodeId: string;
  code: string;
  referralUrl: string;
  created: boolean;
  participantUserId: string | null;
};

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 50);
}

function pilotSlug(sourceParticipantId: string): string {
  const compact = sourceParticipantId.replace(/-/g, '').slice(0, 40);
  return `pilot-${compact}`.slice(0, 64);
}

function deterministicCodeFromSource(sourceParticipantId: string, hint?: string | null): string {
  if (hint?.trim()) {
    const fromHint = normalizeCode(hint);
    if (fromHint.length >= 4) return fromHint;
  }
  const compact = sourceParticipantId.replace(/-/g, '').toUpperCase();
  return `P${compact.slice(0, 8)}`;
}

function commissionPctDecimal(kind: CommissionStructureKind | undefined, value: number | undefined): number {
  const v = value ?? 0;
  if (!kind || kind === 'pct_deal_value') {
    const pct = v > 1 ? v / 100 : v;
    return Math.min(1, Math.max(0, pct));
  }
  if (kind === 'pct_of_participant') {
    const pct = v > 1 ? v / 100 : v;
    return Math.min(1, Math.max(0, pct));
  }
  return 0.1;
}

export async function resolveSupabaseUserIdByEmail(email: string): Promise<string | null> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) {
      log.warn('resolveSupabaseUserIdByEmail listUsers failed', { error: error.message });
      return null;
    }
    const match = data.users.find((u) => u.email?.toLowerCase() === trimmed);
    return match?.id ?? null;
  } catch (e) {
    log.warn('resolveSupabaseUserIdByEmail error', {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export async function resolveOrganizationIdForOperator(operatorUserId: string): Promise<string | null> {
  const row = await prisma.user_organizations.findFirst({
    where: { user_id: operatorUserId },
    orderBy: { created_at: 'asc' },
    select: { organization_id: true },
  });
  return row?.organization_id ?? null;
}

/**
 * Ensure referral_links + referral_codes exist for an approved participant.
 * Idempotent on sourceParticipantId (via slug) and code string.
 */
export async function ensureReferralIssuance(
  input: EnsureReferralIssuanceInput
): Promise<EnsureReferralIssuanceResult> {
  const {
    organizationId,
    operatorUserId,
    participantName,
    sourceParticipantId,
    referralCodeHint,
    commissionKind,
    commissionValue,
    projectLabel,
  } = input;

  let participantUserId = input.participantUserId?.trim() || null;
  if (!participantUserId && input.participantEmail?.trim()) {
    participantUserId = await resolveSupabaseUserIdByEmail(input.participantEmail);
  }

  const slug = pilotSlug(sourceParticipantId);
  const code = deterministicCodeFromSource(sourceParticipantId, referralCodeHint);

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

  const existingBySlug = await prisma.referral_links.findFirst({
    where: { organization_id: organizationId, slug },
    include: { referral_code: true, referral_link_splits: true, referral_rules: true },
  });

  if (existingBySlug?.referral_code) {
    const rc = existingBySlug.referral_code;
    if (participantUserId && rc.participant_user_id !== participantUserId) {
      await prisma.referral_codes.update({
        where: { id: rc.id },
        data: { participant_user_id: participantUserId },
      });
    }
    return {
      referralLinkId: existingBySlug.id,
      referralCodeId: rc.id,
      code: rc.code,
      referralUrl: buildReferralShareUrl(baseUrl, {
        code: rc.code,
        slug: rc.slug ?? existingBySlug.slug,
        referralLinkSlug: existingBySlug.slug,
      }),
      created: false,
      participantUserId: participantUserId ?? rc.participant_user_id,
    };
  }

  const existingByCode = await prisma.referral_links.findUnique({
    where: { code },
    include: { referral_code: true },
  });

  if (existingByCode && existingByCode.organization_id === organizationId) {
    let linkId = existingByCode.id;
    if (!existingByCode.slug) {
      await prisma.referral_links.update({
        where: { id: linkId },
        data: { slug },
      });
    }
    let rc = existingByCode.referral_code;
    if (!rc) {
      rc = await prisma.referral_codes.create({
        data: {
          id: randomUUID(),
          organization_id: organizationId,
          participant_user_id: participantUserId,
          referral_link_id: linkId,
          code,
          slug: null,
          status: 'ACTIVE',
        },
      });
      return {
        referralLinkId: linkId,
        referralCodeId: rc.id,
        code: rc.code,
        referralUrl: buildReferralShareUrl(baseUrl, { code, slug, referralLinkSlug: slug }),
        created: true,
        participantUserId,
      };
    }
    if (participantUserId && rc.participant_user_id !== participantUserId) {
      await prisma.referral_codes.update({
        where: { id: rc.id },
        data: { participant_user_id: participantUserId },
      });
    }
    return {
      referralLinkId: linkId,
      referralCodeId: rc.id,
      code: rc.code,
      referralUrl: buildReferralShareUrl(baseUrl, {
        code: rc.code,
        slug: rc.slug ?? existingByCode.slug,
        referralLinkSlug: existingByCode.slug,
      }),
      created: false,
      participantUserId: participantUserId ?? rc.participant_user_id,
    };
  }

  if (participantUserId) {
    const existingForUser = await prisma.referral_codes.findFirst({
      where: {
        organization_id: organizationId,
        participant_user_id: participantUserId,
        status: 'ACTIVE',
      },
      include: { referral_links: true },
    });
    if (existingForUser) {
      return {
        referralLinkId: existingForUser.referral_link_id,
        referralCodeId: existingForUser.id,
        code: existingForUser.code,
        referralUrl: buildReferralShareUrl(baseUrl, {
          code: existingForUser.code,
          slug: existingForUser.slug,
          referralLinkSlug: existingForUser.referral_links.slug,
        }),
        created: false,
        participantUserId,
      };
    }
  }

  const pct = commissionPctDecimal(commissionKind, commissionValue);
  const checkoutConfig = {
    pilotParticipantId: sourceParticipantId,
    participantEmail: input.participantEmail?.trim().toLowerCase() || null,
    participantName: participantName?.trim() || null,
    projectLabel: projectLabel?.trim() || null,
    commissionKind: commissionKind ?? 'pct_deal_value',
    commissionValue: commissionValue ?? 10,
    issuedAt: new Date().toISOString(),
  } satisfies Record<string, unknown>;

  const created = await prisma.$transaction(async (tx) => {
    const link = await tx.referral_links.create({
      data: {
        organization_id: organizationId,
        created_by_user_id: operatorUserId,
        code,
        slug,
        status: 'ACTIVE',
        checkout_config: checkoutConfig as Prisma.InputJsonValue,
      },
    });

    const hasUser = !!participantUserId;
    if (hasUser && pct > 0) {
      await tx.referral_rules.create({
        data: {
          referral_link_id: link.id,
          consultant_id: participantUserId,
          bd_partner_id: null,
          consultant_pct: pct,
          bd_partner_pct: 0,
          basis: 'GROSS',
        },
      });
    } else {
      const pctDisplay = (pct * 100).toFixed(2);
      await tx.referral_link_splits.create({
        data: {
          referral_link_id: link.id,
          label: participantName?.trim() || 'Partner 1',
          percentage: Number(pctDisplay),
          beneficiary_id: null,
          sort_order: 0,
        },
      });
    }

    const rc = await tx.referral_codes.create({
      data: {
        id: randomUUID(),
        organization_id: organizationId,
        participant_user_id: participantUserId,
        referral_link_id: link.id,
        code,
        status: 'ACTIVE',
      },
    });

    return { link, rc };
  });

  log.info('Referral issued on participant approval', {
    organizationId,
    sourceParticipantId,
    code,
    referralLinkId: created.link.id,
    participantUserId,
  });

  return {
    referralLinkId: created.link.id,
    referralCodeId: created.rc.id,
    code: created.rc.code,
    referralUrl: buildReferralShareUrl(baseUrl, {
      code,
      slug,
      referralLinkSlug: slug,
    }),
    created: true,
    participantUserId,
  };
}
