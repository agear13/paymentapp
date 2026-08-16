import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { requireTreasuryOrganizationAccess } from '@/lib/treasury/api/require-treasury-access';
import { computeTreasuryReconciliationMetrics } from '@/lib/treasury/reconciliation/metrics';

export async function GET(req: NextRequest) {
  const auth = await getCurrentUserForApi(req);
  if (!auth.user) return auth.response!;

  const access = await requireTreasuryOrganizationAccess(req);
  if (!access.ok) {
    return access.response;
  }

  const metrics = await computeTreasuryReconciliationMetrics(access.organizationId);
  return NextResponse.json({ metrics });
}
