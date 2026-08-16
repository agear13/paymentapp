import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { requireTreasuryOrganizationAccess } from '@/lib/treasury/api/require-treasury-access';
import { buildInvoiceTreasuryReconciliation } from '@/lib/treasury/reconciliation/chain';

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
  const reconciliation = await buildInvoiceTreasuryReconciliation(
    access.organizationId,
    paymentLinkId
  );

  if (!reconciliation) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  return NextResponse.json({ reconciliation });
}
