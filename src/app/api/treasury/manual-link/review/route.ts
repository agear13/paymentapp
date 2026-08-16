import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { requireTreasuryOrganizationAccess } from '@/lib/treasury/api/require-treasury-access';
import {
  getManualReconciliationReviewItem,
  listManualReconciliationReviewItems,
} from '@/lib/treasury/reconciliation/manual-link-review';

export async function GET(req: NextRequest) {
  const auth = await getCurrentUserForApi(req);
  if (!auth.user) return auth.response!;

  const access = await requireTreasuryOrganizationAccess(req);
  if (!access.ok) {
    return access.response;
  }

  const { searchParams } = new URL(req.url);
  const reviewId = searchParams.get('reviewId');

  if (reviewId) {
    const item = await getManualReconciliationReviewItem(access.organizationId, reviewId);
    if (!item) {
      return NextResponse.json({ error: 'Review item not found' }, { status: 404 });
    }
    return NextResponse.json({ item });
  }

  const items = await listManualReconciliationReviewItems(access.organizationId);
  return NextResponse.json({ items });
}
