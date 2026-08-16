import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { requireTreasuryOrganizationAccess } from '@/lib/treasury/api/require-treasury-access';
import { listTreasuryActivity } from '@/lib/treasury/reconciliation/chain';

export async function GET(req: NextRequest) {
  const auth = await getCurrentUserForApi(req);
  if (!auth.user) return auth.response!;

  const access = await requireTreasuryOrganizationAccess(req);
  if (!access.ok) {
    return access.response;
  }

  const { searchParams } = new URL(req.url);
  const limit = Number.parseInt(searchParams.get('limit') || '100', 10);
  const paymentLinkId = searchParams.get('paymentLinkId');
  const filter = searchParams.get('filter') as
    | 'all'
    | 'needs_review'
    | 'unknown'
    | 'ambiguous'
    | 'exceptions'
    | 'awaiting_bank'
    | null;

  const activity = await listTreasuryActivity(access.organizationId, {
    limit: Number.isFinite(limit) ? limit : 100,
    paymentLinkId: paymentLinkId ?? undefined,
    filter: filter ?? 'all',
  });

  return NextResponse.json({ activity });
}
