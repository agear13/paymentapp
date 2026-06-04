/**
 * Production commission propagation lookup (beta admin only).
 *
 * GET /api/admin/commission-propagation-trace?stripePaymentIntentId=pi_...
 * GET /api/admin/commission-propagation-trace?shortCode=ABC12345
 * GET /api/admin/commission-propagation-trace?paymentLinkId=<uuid>
 * GET /api/admin/commission-propagation-trace?paymentEventId=<uuid>
 *
 * Uses the deployment's DATABASE_URL (Render Postgres on production).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/middleware';
import { isBetaAdminEmail } from '@/lib/auth/admin-shared';
import { applyRateLimit } from '@/lib/rate-limit';
import { lookupCommissionPropagationChain } from '@/lib/referrals/commission-propagation-lookup.server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, 'api');
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const auth = await requireAuth(request);
  if (!auth.user) return auth.response!;

  if (!isBetaAdminEmail(auth.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const result = await lookupCommissionPropagationChain({
    stripePaymentIntentId: params.get('stripePaymentIntentId') ?? undefined,
    shortCode: params.get('shortCode') ?? undefined,
    paymentLinkId: params.get('paymentLinkId') ?? undefined,
    paymentEventId: params.get('paymentEventId') ?? undefined,
  });

  if ('error' in result) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json({ ok: true, data: result });
}
