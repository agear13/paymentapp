/**
 * GET /api/payment-links/nav-activation?organizationId=
 * Returns whether the org should see the full Payment Links main nav (vs simplified onboarding nav).
 * Same activation heuristic as {@link isPaymentLinksNavActivated} + shared org loader.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { getDashboardProductProfile } from '@/lib/auth/dashboard-product.server';
import { loadPaymentLinksOrgContext } from '@/lib/payment-links/org-context.server';
import { isPaymentLinksNavActivated } from '@/lib/payment-links/activation';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;

    const organizationId = request.nextUrl.searchParams.get('organizationId');
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const canView = await checkUserPermission(auth.user.id, organizationId, 'view_payment_links');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const profile = await getDashboardProductProfile();
    if (profile === 'rabbit_hole_pilot') {
      return NextResponse.json({ activated: true });
    }

    const { railSetup, paymentLinkCount } = await loadPaymentLinksOrgContext(organizationId);
    const activated = isPaymentLinksNavActivated(railSetup, paymentLinkCount);

    return NextResponse.json({ activated });
  } catch (e) {
    console.error('[payment-links/nav-activation]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
