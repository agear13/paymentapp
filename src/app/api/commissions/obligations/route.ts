/**
 * Commission Obligations API
 * GET /api/commissions/obligations - List commission obligations with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';

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
    const consultantId = searchParams.get('consultantId');
    const bdPartnerId = searchParams.get('bdPartnerId');
    const paymentLinkId = searchParams.get('paymentLinkId');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const canView = await checkUserPermission(user.id, organizationId, 'view_payment_links');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const where: Record<string, unknown> = {
      payment_links: { organization_id: organizationId },
    };

    if (consultantId || bdPartnerId) {
      const ruleMatch: Record<string, unknown> = {};
      if (consultantId) ruleMatch.consultant_id = consultantId;
      if (bdPartnerId) ruleMatch.bd_partner_id = bdPartnerId;
      where.referral_links = {
        referral_rules: { some: ruleMatch },
      };
    }
    if (paymentLinkId) where.payment_link_id = paymentLinkId;
    if (status) where.status = status;

    const obligations = await prisma.commission_obligations.findMany({
      where,
      include: {
        payment_links: { select: { short_code: true, invoice_reference: true } },
        referral_links: { select: { code: true } },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      data: obligations.map((o) => ({
        id: o.id,
        paymentLinkId: o.payment_link_id,
        referralLinkId: o.referral_link_id,
        stripeEventId: o.stripe_event_id,
        consultantAmount: Number(o.consultant_amount),
        bdPartnerAmount: Number(o.bd_partner_amount),
        currency: o.currency,
        status: o.status,
        correlationId: o.correlation_id,
        createdAt: o.created_at,
        shortCode: o.payment_links?.short_code,
        invoiceReference: o.payment_links?.invoice_reference,
        referralCode: o.referral_links?.code,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
