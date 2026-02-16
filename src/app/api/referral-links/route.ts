/**
 * Referral Links API - Create and list commission-enabled referral links
 * POST /api/referral-links - Create new referral link with rules
 * GET /api/referral-links - List referral links for organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { z } from 'zod';

function normalizePct(value: number): number {
  return value > 1 ? value / 100 : value;
}

const CreateReferralLinkSchema = z.object({
  organizationId: z.string().uuid(),
  code: z.string().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/),
  userType: z.enum(['BD_PARTNER', 'CONSULTANT']).optional(),
  consultantId: z.string().uuid().optional().nullable(),
  bdPartnerId: z.string().uuid().optional().nullable(),
  /** When consultant creates link: paste BD referral code to inherit bdPartnerId + bdPartnerPct */
  bdReferralCode: z.string().max(50).optional(),
  consultantPct: z.number().min(0).max(100),
  bdPartnerPct: z.number().min(0).max(100),
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
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;
    const { user } = auth;

    const body = await request.json();
    const parsed = CreateReferralLinkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.errors },
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
    } = parsed.data;

    let consultantPct = normalizePct(consultantPctRaw);
    let bdPartnerPct = normalizePct(bdPartnerPctRaw);
    let resolvedBdPartnerId: string | null = bdPartnerId ?? null;

    // When consultant provides bdReferralCode, inherit bd_partner_id and bd_partner_pct from that link
    if (bdReferralCode?.trim()) {
      const parentLink = await prisma.referral_links.findFirst({
        where: {
          code: bdReferralCode.trim().toUpperCase(),
          organization_id: organizationId,
        },
        include: { referral_rules: { take: 1 } },
      });
      if (parentLink?.referral_rules[0]) {
        const rule = parentLink.referral_rules[0];
        resolvedBdPartnerId = rule.bd_partner_id;
        bdPartnerPct = Number(rule.bd_partner_pct);
      }
    }

    if (consultantPct + bdPartnerPct > 1) {
      return NextResponse.json(
        {
          error: 'Commission percentages cannot exceed 100% combined',
          consultantPct,
          bdPartnerPct,
          sum: consultantPct + bdPartnerPct,
        },
        { status: 400 }
      );
    }

    // Resolve final payee ids before validating (for BD-only links consultantId can be null)
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
      return NextResponse.json(
        { error: 'consultantId is required when consultantPct > 0' },
        { status: 400 }
      );
    }
    if (bdPartnerPct > 0 && finalBdPartnerId == null) {
      return NextResponse.json(
        { error: 'bdPartnerId is required when bdPartnerPct > 0' },
        { status: 400 }
      );
    }

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
    log.info(
      { correlationId, referralLinkId: referralLink.id, code: normalizedCode, userType },
      'Referral link created'
    );

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
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    return NextResponse.json({
      data: links.map((l) => {
        const rule = l.referral_rules[0];
        return {
          id: l.id,
          code: l.code,
          status: l.status,
          url: `${baseUrl}/r/${l.code}`,
          consultantPct: rule ? Number(rule.consultant_pct) : 0,
          bdPartnerPct: rule ? Number(rule.bd_partner_pct) : 0,
          basis: rule?.basis ?? 'GROSS',
          checkoutConfig: l.checkout_config,
          createdAt: l.created_at,
        };
      }),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
