/**
 * Commission Ledger Entries API
 * GET /api/commissions/ledger-entries - List ledger entries for commissions (idempotency_key prefix 'commission-')
 * 
 * NOTE: This API is restricted to beta admins during BETA_LOCKDOWN_MODE
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { isBetaAdminEmail } from '@/lib/auth/admin';
import { applyRateLimit } from '@/lib/rate-limit';

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
    const paymentLinkId = searchParams.get('paymentLinkId');
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
      idempotency_key: { startsWith: 'commission-' },
    };
    if (paymentLinkId) where.payment_link_id = paymentLinkId;

    const entries = await prisma.ledger_entries.findMany({
      where,
      include: {
        ledger_accounts: { select: { code: true, name: true, account_type: true } },
        payment_links: { select: { short_code: true } },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      data: entries.map((e) => ({
        id: e.id,
        paymentLinkId: e.payment_link_id,
        accountCode: e.ledger_accounts.code,
        accountName: e.ledger_accounts.name,
        entryType: e.entry_type,
        amount: e.amount.toString(),
        currency: e.currency,
        description: e.description,
        idempotencyKey: e.idempotency_key,
        createdAt: e.created_at,
        shortCode: e.payment_links?.short_code,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
