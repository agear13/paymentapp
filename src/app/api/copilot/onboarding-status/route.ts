import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { getDashboardProductProfile } from '@/lib/auth/dashboard-product.server';
import { getMerchantSetupStatus } from '@/lib/copilot/tools/get-merchant-setup-status';
import type { MerchantSetupStatusResult } from '@/lib/copilot/tools/get-merchant-setup-status';

/**
 * GET /api/copilot/onboarding-status?organizationId=
 * Payment Links onboarding only — returns structured setup status from getMerchantSetupStatus.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ ok: false, error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;

    const organizationId = request.nextUrl.searchParams.get('organizationId');
    if (!organizationId) {
      return NextResponse.json({ ok: false, error: 'organizationId is required' }, { status: 400 });
    }

    const canView = await checkUserPermission(auth.user.id, organizationId, 'view_payment_links');
    if (!canView) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const profile = await getDashboardProductProfile();

    if (profile === 'rabbit_hole_pilot' || profile === 'strait_experiences_pilot') {
      const hidden: MerchantSetupStatusResult = {
        organizationId,
        overallStatus: 'ready',
        summary: 'Onboarding assistant is not available for this workspace.',
        steps: [],
        showOnboardingAssistant: false,
        nextRecommendedAction: null,
      };
      return NextResponse.json({ ok: true, result: hidden });
    }

    if (profile !== 'standard' && profile !== 'admin') {
      const hidden: MerchantSetupStatusResult = {
        organizationId,
        overallStatus: 'ready',
        summary: 'Onboarding assistant is not available for this workspace.',
        steps: [],
        showOnboardingAssistant: false,
        nextRecommendedAction: null,
      };
      return NextResponse.json({ ok: true, result: hidden });
    }

    const result = await getMerchantSetupStatus(organizationId);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error('[copilot/onboarding-status]', e);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
