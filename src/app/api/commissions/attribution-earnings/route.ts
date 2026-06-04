import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/middleware';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { checkUserPermission } from '@/lib/auth/permissions';
import { listAttributionEarningsForOrganization } from '@/lib/commissions/attribution-earnings.server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/commissions/attribution-earnings
 * Per-participant attribution commission balances from commission_obligation_items.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.user) return auth.response!;

  const org = await getOrganizationForAuthenticatedUser(auth.user.id);
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  const canView = await checkUserPermission(auth.user.id, org.id, 'view_payment_links');
  if (!canView) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const data = await listAttributionEarningsForOrganization(org.id);
  return NextResponse.json({ data });
}
