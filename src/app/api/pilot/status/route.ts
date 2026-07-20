import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/middleware';
import { isAdminEmail } from '@/lib/config/env';
import { hasOrganizationAccess } from '@/lib/auth/organization-access';
import { collectPilotReadinessSnapshot } from '@/lib/pilot/pilot-readiness.server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pilot/status?organization_id=xxx
 * Admin-only pilot command centre data.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.user) return auth.response!;

  if (!isAdminEmail(auth.user.email ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organization_id');

  if (organizationId) {
    const hasAccess = await hasOrganizationAccess(auth.user.id, organizationId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this organization' },
        { status: 403 }
      );
    }
  }

  const snapshot = await collectPilotReadinessSnapshot({
    organizationId,
    userId: auth.user.id,
  });

  return NextResponse.json({ success: true, data: snapshot });
}
