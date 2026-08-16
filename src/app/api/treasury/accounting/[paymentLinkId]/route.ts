import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { requireTreasuryOrganizationAccess } from '@/lib/treasury/api/require-treasury-access';
import { buildTreasuryAccountingView } from '@/lib/treasury/accounting/build-treasury-accounting-view';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ paymentLinkId: string }> }
) {
  const auth = await getCurrentUserForApi(req);
  if (!auth.user) return auth.response!;

  const access = await requireTreasuryOrganizationAccess(req);
  if (!access.ok) {
    return access.response;
  }

  const { paymentLinkId } = await context.params;
  const view = await buildTreasuryAccountingView(access.organizationId, paymentLinkId);

  if (!view) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  return NextResponse.json({ accounting: view });
}
