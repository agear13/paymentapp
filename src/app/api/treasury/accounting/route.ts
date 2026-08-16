import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { requireTreasuryOrganizationAccess } from '@/lib/treasury/api/require-treasury-access';
import { listTreasuryAccountingSummaries } from '@/lib/treasury/accounting/build-treasury-accounting-view';
import { computeTreasuryAccountingMetrics } from '@/lib/treasury/accounting/metrics';

export async function GET(req: NextRequest) {
  const auth = await getCurrentUserForApi(req);
  if (!auth.user) return auth.response!;

  const access = await requireTreasuryOrganizationAccess(req);
  if (!access.ok) {
    return access.response;
  }

  const { searchParams } = new URL(req.url);
  const includeMetrics = searchParams.get('metrics') === '1';

  const summaries = await listTreasuryAccountingSummaries(access.organizationId);
  const payload: {
    summaries: typeof summaries;
    metrics?: Awaited<ReturnType<typeof computeTreasuryAccountingMetrics>>;
  } = { summaries };

  if (includeMetrics) {
    payload.metrics = await computeTreasuryAccountingMetrics(access.organizationId);
  }

  return NextResponse.json(payload);
}
