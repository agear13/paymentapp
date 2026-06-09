import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { requireOrganizationAccessOrForbidden } from '@/lib/auth/require-organization-access-api.server';
import { getOperationalInsights } from '@/lib/reports/operational-insights';

/**
 * GET /api/reports/operational-insights
 *
 * Returns system-detected operational states for the reports dashboard.
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

    const snapshot = await getOperationalInsights(organizationId);

    return NextResponse.json(snapshot);
  } catch (error: unknown) {
    console.error('[Operational Insights] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load operational insights' },
      { status: 500 }
    );
  }
}
