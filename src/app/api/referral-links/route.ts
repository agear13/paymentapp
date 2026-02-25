/**
 * Referral Links API - Create and list commission-enabled referral links
 * POST /api/referral-links - Create new referral link with rules
 * GET /api/referral-links - List referral links for organization
 * 
 * NOTE: This API is restricted to beta admins during BETA_LOCKDOWN_MODE
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { isBetaAdminEmail } from '@/lib/auth/admin-shared';
import { applyRateLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { z } from 'zod';

function checkBetaLockdown(userEmail?: string | null): NextResponse | null {
  const betaLockdownEnabled = process.env.BETA_LOCKDOWN_MODE !== 'false';
  if (betaLockdownEnabled && !isBetaAdminEmail(userEmail)) {
    return NextResponse.json(
      { error: 'Forbidden: This feature is restricted during beta' },
      { status: 403 }
    );
  }
  return null;
}

function normalizePct(value: number): number {
  return value > 1 ? value / 100 : value;
}

const SplitSchema = z.object({
  label: z.string().min(1).max(255),
  percentage: z.number().min(0).max(100),
  beneficiary_id: z.string().uuid().optional().nullable(),
  sort_order: z.number().int().min(0).optional(),
});

const CreateReferralLinkSchema = z
  .object({
    organizationId: z.string().uuid(),
    code: z.string().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/),
    userType: z.enum(['BD_PARTNER', 'CONSULTANT']).optional(),
    consultantId: z.string().uuid().optional().nullable(),
    bdPartnerId: z.string().uuid().optional().nullable(),
    bdReferralCode: z.string().max(50).optional(),
    consultantPct: z.number().min(0).max(100).optional(),
    bdPartnerPct: z.number().min(0).max(100).optional(),
    basis: z.enum(['GROSS', 'NET']).default('GROSS'),
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
    checkoutConfig: z
      .object({
        amount: z.number().optional(),
        currency: z.string().optional(),
        description: z.string().optional(),
        productName: z.string().optional(),
      })
      .optional(),
    /** Generic splits (1-15 partners). If provided, legacy consultantPct/bdPartnerPct are ignored. */
    splits: z.array(SplitSchema).min(1).max(15).optional(),
  })
  .refine(
    (data) => {
      if (data.splits && data.splits.length > 0) {
        const total = data.splits.reduce((s, x) => s + x.percentage, 0);
        return total <= 100;
      }
      return true;
    },
    { message: 'Total split percentage cannot exceed 100%', path: ['splits'] }
  )
  .refine(
    (data) => {
      if (!data.splits || data.splits.length === 0) {
        return data.consultantPct !== undefined && data.bdPartnerPct !== undefined;
      }
      return true;
    },
    { message: 'consultantPct and bdPartnerPct are required when not using splits', path: ['consultantPct'] }
  );

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;
    const { user } = auth;

    const lockdownResponse = checkBetaLockdown(user.email);
    if (lockdownResponse) return lockdownResponse;

    const body = await request.json();
    const parsed = CreateReferralLinkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      organizationId,
      code,
      userType,
      consultantId,
      bdPartnerId,
      bdReferralCode,
      consultantPct: consultantPctRaw,
      bdPartnerPct: bdPartnerPctRaw,
      basis,
      status,
      checkoutConfig,
      splits: splitsInput,
    } = parsed.data;

    const canCreate = await checkUserPermission(user.id, organizationId, 'create_payment_links');
    if (!canCreate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const normalizedCode = code.trim().toUpperCase();
    const existing = await prisma.referral_links.findUnique({
      where: { code: normalizedCode },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Referral code ${normalizedCode} already exists` },
        { status: 409 }
      );
    }

    if (splitsInput && splitsInput.length > 0) {
      const [referralLink] = await prisma.$transaction([
        prisma.referral_links.create({
          data: {
            organization_id: organizationId,
            created_by_user_id: user.id,
            code: normalizedCode,
            status,
            checkout_config: checkoutConfig || undefined,
          },
        }),
      ]);
      await prisma.referral_link_splits.createMany({
        data: splitsInput.map((s, i) => ({
          referral_link_id: referralLink.id,
          label: s.label || `Partner ${i + 1}`,
          percentage: s.percentage,
          beneficiary_id: s.beneficiary_id ?? undefined,
          sort_order: s.sort_order ?? i,
        })),
      });
      const correlationId = `ref-${normalizedCode}-${Date.now()}`;
      log.info('Referral link created with splits', { correlationId, referralLinkId: referralLink.id, code: normalizedCode, splitsCount: splitsInput.length });
      return NextResponse.json(
        { data: { id: referralLink.id, code: referralLink.code, status: referralLink.status, url: `/r/${referralLink.code}` } },
        { status: 201 }
      );
    }

    const consultantPct = normalizePct(consultantPctRaw ?? 0);
    const bdPartnerPct = normalizePct(bdPartnerPctRaw ?? 0);
    let resolvedBdPartnerId: string | null = bdPartnerId ?? null;

    if (bdReferralCode?.trim()) {
      const parentLink = await prisma.referral_links.findFirst({
        where: { code: bdReferralCode.trim().toUpperCase(), organization_id: organizationId },
        include: { referral_rules: { take: 1 } },
      });
      if (parentLink?.referral_rules[0]) {
        const rule = parentLink.referral_rules[0];
        resolvedBdPartnerId = rule.bd_partner_id;
      }
    }

    if (consultantPct + bdPartnerPct > 1) {
      return NextResponse.json(
        { error: 'Commission percentages cannot exceed 100% combined', consultantPct, bdPartnerPct, sum: consultantPct + bdPartnerPct },
        { status: 400 }
      );
    }

    let finalConsultantId: string | null;
    let finalBdPartnerId: string | null;
    if (userType === 'BD_PARTNER') {
      finalBdPartnerId = user.id;
      finalConsultantId = consultantId ?? null;
    } else if (userType === 'CONSULTANT') {
      finalConsultantId = user.id;
      finalBdPartnerId = resolvedBdPartnerId ?? bdPartnerId ?? null;
    } else {
      finalConsultantId = consultantId ?? user.id;
      finalBdPartnerId = bdPartnerId ?? null;
    }

    if (consultantPct > 0 && finalConsultantId == null) {
      return NextResponse.json({ error: 'consultantId is required when consultantPct > 0' }, { status: 400 });
    }
    if (bdPartnerPct > 0 && finalBdPartnerId == null) {
      return NextResponse.json({ error: 'bdPartnerId is required when bdPartnerPct > 0' }, { status: 400 });
    }

    const [referralLink] = await prisma.$transaction([
      prisma.referral_links.create({
        data: {
          organization_id: organizationId,
          created_by_user_id: user.id,
          code: normalizedCode,
          status,
          checkout_config: checkoutConfig || undefined,
        },
      }),
    ]);

    await prisma.referral_rules.create({
      data: {
        referral_link_id: referralLink.id,
        consultant_id: finalConsultantId,
        bd_partner_id: finalBdPartnerId,
        consultant_pct: consultantPct,
        bd_partner_pct: bdPartnerPct,
        basis,
      },
    });

    const correlationId = `ref-${normalizedCode}-${Date.now()}`;
    log.info('Referral link created', { correlationId, referralLinkId: referralLink.id, code: normalizedCode, userType });

    return NextResponse.json(
      {
        data: {
          id: referralLink.id,
          code: referralLink.code,
          status: referralLink.status,
          url: `/r/${referralLink.code}`,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;
    const { user } = auth;

    const lockdownResponse = checkBetaLockdown(user.email);
    if (lockdownResponse) return lockdownResponse;

    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const canView = await checkUserPermission(user.id, organizationId, 'view_payment_links');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const links = await prisma.referral_links.findMany({
      where: { organization_id: organizationId },
      include: {
        referral_rules: { take: 1 },
        referral_link_splits: { orderBy: { sort_order: 'asc' } },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    type LinkWithRelations = (typeof links)[0] & {
      referral_rules?: { consultant_pct: unknown; bd_partner_pct: unknown; basis: string }[];
      referral_link_splits?: { id: string; label: string; percentage: unknown; beneficiary_id: string | null; sort_order: number }[];
    };
    return NextResponse.json({
      data: links.map((l) => {
        const row = l as LinkWithRelations;
        const rule = row.referral_rules?.[0];
        const splits = (row.referral_link_splits ?? []).map((s) => ({
          id: s.id,
          label: s.label,
          percentage: Number(s.percentage),
          beneficiary_id: s.beneficiary_id,
          sort_order: s.sort_order,
        }));
        return {
          id: row.id,
          code: row.code,
          status: row.status,
          url: `${baseUrl}/r/${row.code}`,
          consultantPct: rule ? Number(rule.consultant_pct) : 0,
          bdPartnerPct: rule ? Number(rule.bd_partner_pct) : 0,
          basis: rule?.basis ?? 'GROSS',
          checkoutConfig: row.checkout_config,
          createdAt: row.created_at,
          splits: splits.length > 0 ? splits : undefined,
        };
      }),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
