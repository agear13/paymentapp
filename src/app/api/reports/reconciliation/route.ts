import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { requireOrganizationAccessOrForbidden } from '@/lib/auth/require-organization-access-api.server';
import { buildReconciliationReport } from '@/lib/reports/reconciliation-report.server';

/**
 * GET /api/reports/reconciliation
 *
 * Returns reconciliation report comparing:
 * - Expected balances (from payment links)
 * - Actual balances (from ledger entries)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const forbidden = await requireOrganizationAccessOrForbidden(user.id, organizationId);
    if (forbidden) return forbidden;

    const data = await buildReconciliationReport(organizationId);

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('[Reconciliation] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate reconciliation report' },
      { status: 500 }
    );
  }
}
