import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { checkUserPermission } from '@/lib/auth/permissions';
import { isBetaAdminEmail } from '@/lib/auth/admin-shared';
import { applyRateLimit } from '@/lib/rate-limit';
import { isMerchantCregisSelectable } from '@/lib/payouts/rails/cregis-connection.server';
import { isMerchantAirwallexReady } from '@/lib/payouts/rails/airwallex-connection.server';
import { EMPTY_PAYOUT_RAIL_READINESS } from '@/lib/payouts/payout-rail-readiness';

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

/**
 * Local configuration snapshot for payout rail UX.
 * Does not call provider APIs or return credentials.
 */
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

    const org = await getOrganizationForAuthenticatedUser(user.id);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    const organizationId = org.id;

    const canView = await checkUserPermission(user.id, organizationId, 'view_payment_links');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchant = await prisma.merchant_settings.findFirst({
      where: { organization_id: organizationId },
      select: { hedera_account_id: true },
    });

    return NextResponse.json({
      ...EMPTY_PAYOUT_RAIL_READINESS,
      merchantHederaReady: Boolean(merchant?.hedera_account_id?.trim()),
      merchantCregisReady: await isMerchantCregisSelectable(organizationId),
      merchantAirwallexReady: await isMerchantAirwallexReady(organizationId),
    });
  } catch (error) {
    console.error('Payout rail readiness failed', error);
    return NextResponse.json({ error: 'Failed to load payout rail readiness' }, { status: 500 });
  }
}
