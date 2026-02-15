/**
 * Referral Links API - Create commission-enabled referral links
 * POST /api/referral-links - Create new referral link with rules
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const CreateReferralLinkSchema = z.object({
  organizationId: z.string().uuid(),
  code: z.string().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/),
  consultantId: z.string().uuid(),
  bdPartnerId: z.string().uuid().optional().nullable(),
  consultantPct: z.number().min(0).max(1),
  bdPartnerPct: z.number().min(0).max(1),
  checkoutConfig: z
    .object({
      amount: z.number().optional(),
      currency: z.string().optional(),
      description: z.string().optional(),
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
      consultantId,
      bdPartnerId,
      consultantPct,
      bdPartnerPct,
      checkoutConfig,
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

    const [referralLink] = await prisma.$transaction([
      prisma.referral_links.create({
        data: {
          organization_id: organizationId,
          created_by_user_id: user.id,
          code: normalizedCode,
          status: 'ACTIVE',
          checkout_config: checkoutConfig || undefined,
        },
      }),
    ]);

    await prisma.referral_rules.create({
      data: {
        referral_link_id: referralLink.id,
        consultant_id: consultantId,
        bd_partner_id: bdPartnerId ?? null,
        consultant_pct: consultantPct,
        bd_partner_pct: bdPartnerPct ?? 0,
        basis: 'GROSS',
      },
    });

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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
