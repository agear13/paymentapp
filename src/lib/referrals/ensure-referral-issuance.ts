/**
 * Idempotent referral link + code issuance after participant approval.
 * Reuses existing active rows; never regenerates codes.
 */

import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildReferralShareUrl,
  getReferralPublicBaseUrl,
} from '@/lib/referrals/referral-share-url';
import { log } from '@/lib/logger';
import { referralTrace } from '@/lib/referrals/referral-trace';
import type { CommissionStructureKind } from '@/lib/deal-network-demo/commission-structure';
import {
  type ParticipantReferralCommerce,
  commerceCommissionPctDecimal,
  mergeReferralCommerceIntoCheckoutConfig,
  mergeManualPayoutMethodIntoCheckoutConfig,
  normalizeReferralCommerce,
} from '@/lib/referrals/referral-commerce-config';
import type { ManualPayoutMethod } from '@/lib/participants/manual-payout-method';

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
  referralCommerce?: ParticipantReferralCommerce | null;
  manualPayoutMethod?: ManualPayoutMethod | null;
};

function isReferralCommerceMode(commerce?: ParticipantReferralCommerce | null): boolean {
  return commerce?.commissionMode === 'referral_commerce';
}

function buildIssuanceCheckoutConfig(input: EnsureReferralIssuanceInput): Record<string, unknown> {
  const base: Record<string, unknown> = {
    pilotParticipantId: input.sourceParticipantId,
    participantEmail: input.participantEmail?.trim().toLowerCase() || null,
    participantName: input.participantName?.trim() || null,
    projectLabel: input.projectLabel?.trim() || null,
    commissionKind: input.commissionKind ?? 'pct_deal_value',
    commissionValue: input.commissionValue ?? 10,
    issuedAt: new Date().toISOString(),
  };
  let next = base;
  if (input.referralCommerce) {
    next = mergeReferralCommerceIntoCheckoutConfig(base, normalizeReferralCommerce(input.referralCommerce));
  }
  if (input.manualPayoutMethod) {
    next = mergeManualPayoutMethodIntoCheckoutConfig(next, input.manualPayoutMethod);
  }
  return next;
}

async function syncCheckoutConfigOnLink(
  linkId: string,
  existingConfig: unknown,
  input: EnsureReferralIssuanceInput
): Promise<void> {
  const base =
    existingConfig && typeof existingConfig === 'object'
      ? ({ ...(existingConfig as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const next = { ...base, ...buildIssuanceCheckoutConfig(input) };
  await prisma.referral_links.update({
    where: { id: linkId },
    data: { checkout_config: next as Prisma.InputJsonValue },
  });
}

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
  return normalizeCode(`P${compact.slice(0, 20)}`);
}

function orgScopedReferralCode(baseCode: string, organizationId: string): string {
  const orgSuffix = organizationId.replace(/-/g, '').slice(0, 6).toUpperCase();
  return normalizeCode(`${baseCode}_${orgSuffix}`);
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  );
}

export class ReferralIssuanceError extends Error {
  readonly code:
    | 'ORGANIZATION_NOT_FOUND'
    | 'ISSUANCE_SKIPPED'
    | 'REFERRAL_GENERATION_FAILED'
    | 'PERSISTENCE_FAILED';

  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code:
      | 'ORGANIZATION_NOT_FOUND'
      | 'ISSUANCE_SKIPPED'
      | 'REFERRAL_GENERATION_FAILED'
      | 'PERSISTENCE_FAILED',
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ReferralIssuanceError';
    this.code = code;
    this.details = details;
  }
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

/** Resolve merchant org for a pilot/project deal (operator membership + deal-linked rows). */
export async function resolveOrganizationIdForPilotDeal(
  operatorUserId: string,
  dealId: string
): Promise<string | null> {
  const fromOperator = await resolveOrganizationIdForOperator(operatorUserId);
  if (fromOperator) return fromOperator;

  const obligation = await prisma.deal_network_pilot_obligations.findFirst({
    where: { deal_id: dealId, organization_id: { not: null } },
    orderBy: { created_at: 'desc' },
    select: { organization_id: true },
  });
  if (obligation?.organization_id) return obligation.organization_id;

  const paymentLink = await prisma.payment_links.findFirst({
    where: { pilot_deal_id: dealId },
    orderBy: { created_at: 'desc' },
    select: { organization_id: true },
  });
  if (paymentLink?.organization_id) return paymentLink.organization_id;

  const paymentEvent = await prisma.payment_events.findFirst({
    where: { pilot_deal_id: dealId, organization_id: { not: null } },
    orderBy: { received_at: 'desc' },
    select: { organization_id: true },
  });
  return paymentEvent?.organization_id ?? null;
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
  const emailLookupAttempted = !participantUserId && !!input.participantEmail?.trim();
  if (emailLookupAttempted) {
    participantUserId = await resolveSupabaseUserIdByEmail(input.participantEmail!);
  }

  const slug = pilotSlug(sourceParticipantId);
  let code = deterministicCodeFromSource(sourceParticipantId, referralCodeHint);

  referralTrace('ensureReferralIssuance.start', {
    organizationId,
    operatorUserId,
    sourceParticipantId,
    slug,
    code,
    participantUserIdInput: input.participantUserId ?? null,
    participantUserIdResolved: participantUserId,
    participantEmail: input.participantEmail?.trim().toLowerCase() || null,
    emailLookupAttempted,
    emailLookupHit: emailLookupAttempted ? !!participantUserId : null,
  });

  const baseUrl = getReferralPublicBaseUrl();

  const existingBySlug = await prisma.referral_links.findFirst({
    where: { organization_id: organizationId, slug },
    include: { referral_code: true, referral_link_splits: true, referral_rules: true },
  });

  if (existingBySlug) {
    referralTrace('ensureReferralIssuance.slugLookup', {
      organizationId,
      slug,
      referralLinkId: existingBySlug.id,
      hasReferralCode: !!existingBySlug.referral_code,
      referralCodeId: existingBySlug.referral_code?.id ?? null,
      existingParticipantUserId: existingBySlug.referral_code?.participant_user_id ?? null,
    });
  }

  if (existingBySlug?.referral_code) {
    const rc = existingBySlug.referral_code;
    const rebound = participantUserId && rc.participant_user_id !== participantUserId;
    if (rebound) {
      await prisma.referral_codes.update({
        where: { id: rc.id },
        data: { participant_user_id: participantUserId },
      });
    }
    await syncCheckoutConfigOnLink(existingBySlug.id, existingBySlug.checkout_config, input);
    referralTrace('ensureReferralIssuance.reuseBySlug', {
      organizationId,
      referralLinkId: existingBySlug.id,
      referralCodeId: rc.id,
      code: rc.code,
      created: false,
      participantUserId: participantUserId ?? rc.participant_user_id,
      rebound,
    });
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

  if (existingByCode) {
    referralTrace('ensureReferralIssuance.codeLookup', {
      organizationId,
      code,
      found: true,
      linkOrgId: existingByCode.organization_id,
      orgMatch: existingByCode.organization_id === organizationId,
      hasReferralCode: !!existingByCode.referral_code,
    });
  }

  if (existingByCode && existingByCode.organization_id !== organizationId) {
    code = orgScopedReferralCode(code, organizationId);
    referralTrace('ensureReferralIssuance.codeRemappedForOrg', {
      organizationId,
      sourceParticipantId,
      code,
    });
  }

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
      referralTrace('ensureReferralIssuance.createCodeOnExistingLink', {
        organizationId,
        referralLinkId: linkId,
        code,
      });
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
    await syncCheckoutConfigOnLink(linkId, existingByCode.checkout_config, input);
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

  if (existingBySlug && !existingBySlug.referral_code) {
    await syncCheckoutConfigOnLink(existingBySlug.id, existingBySlug.checkout_config, input);
    const rc = await prisma.referral_codes.create({
      data: {
        id: randomUUID(),
        organization_id: organizationId,
        participant_user_id: participantUserId,
        referral_link_id: existingBySlug.id,
        code: existingBySlug.code,
        status: 'ACTIVE',
      },
    });
    return {
      referralLinkId: existingBySlug.id,
      referralCodeId: rc.id,
      code: rc.code,
      referralUrl: buildReferralShareUrl(baseUrl, {
        code: rc.code,
        slug: existingBySlug.slug,
        referralLinkSlug: existingBySlug.slug,
      }),
      created: true,
      participantUserId,
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
      referralTrace('ensureReferralIssuance.reuseByUser', {
        organizationId,
        participantUserId,
        referralCodeId: existingForUser.id,
        code: existingForUser.code,
      });
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
  const hasUser = !!participantUserId;
  const commerce = input.referralCommerce
    ? normalizeReferralCommerce(input.referralCommerce)
    : null;
  const checkoutConfig = buildIssuanceCheckoutConfig(input);

  let created: { link: { id: string; slug: string | null; code: string }; rc: { id: string; code: string } };
  let createCode = code;
  try {
    created = await prisma.$transaction(async (tx) => {
      const link = await tx.referral_links.create({
        data: {
          organization_id: organizationId,
          created_by_user_id: operatorUserId,
          code: createCode,
          slug,
          status: 'ACTIVE',
          checkout_config: checkoutConfig as Prisma.InputJsonValue,
        },
      });

      if (isReferralCommerceMode(commerce)) {
        const commercePct = commerceCommissionPctDecimal(commerce!);
        const pctDisplay = (commercePct * 100).toFixed(2);
        await tx.referral_link_splits.create({
          data: {
            referral_link_id: link.id,
            label: participantName?.trim() || 'Referral commerce',
            percentage: Number(pctDisplay),
            beneficiary_id: null,
            sort_order: 0,
          },
        });
      } else if (hasUser && pct > 0) {
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
          code: createCode,
          status: 'ACTIVE',
        },
      });

      return { link, rc };
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    createCode = orgScopedReferralCode(code, organizationId);
    log.warn('ensureReferralIssuance.retryWithOrgScopedCode', {
      organizationId,
      sourceParticipantId,
      code: createCode,
    });
    created = await prisma.$transaction(async (tx) => {
      const link = await tx.referral_links.create({
        data: {
          organization_id: organizationId,
          created_by_user_id: operatorUserId,
          code: createCode,
          slug,
          status: 'ACTIVE',
          checkout_config: checkoutConfig as Prisma.InputJsonValue,
        },
      });
      const rc = await tx.referral_codes.create({
        data: {
          id: randomUUID(),
          organization_id: organizationId,
          participant_user_id: participantUserId,
          referral_link_id: link.id,
          code: createCode,
          status: 'ACTIVE',
        },
      });
      return { link, rc };
    });
  }
  code = createCode;

  referralTrace('ensureReferralIssuance.created', {
    organizationId,
    sourceParticipantId,
    referralLinkId: created.link.id,
    referralCodeId: created.rc.id,
    code,
    slug,
    participantUserId,
    created: true,
    commissionRulePath: isReferralCommerceMode(commerce)
      ? 'referral_commerce_splits'
      : hasUser && pct > 0
        ? 'referral_rules'
        : 'referral_link_splits',
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
