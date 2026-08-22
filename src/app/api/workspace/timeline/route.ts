import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/middleware';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { checkUserPermission } from '@/lib/auth/permissions';
import { loadCommercialTimelineForOrganization } from '@/lib/workspace-timeline/commercial-timeline.server';
import { EMPTY_TIMELINE_COMPLETENESS } from '@/lib/workspace-timeline/commercial-timeline-types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspace/timeline
 * Organisation-scoped commercial activity stream derived from persisted records.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.user) return auth.response!;

  const org = await getOrganizationForAuthenticatedUser(auth.user.id);
  if (!org) {
    return NextResponse.json({
      status: 'no_organization',
      events: [],
      hasCommercialActivity: false,
      completeness: EMPTY_TIMELINE_COMPLETENESS,
    });
  }

  const canView = await checkUserPermission(auth.user.id, org.id, 'view_payment_links');
  if (!canView) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const timeline = await loadCommercialTimelineForOrganization({
    organizationId: org.id,
    userId: auth.user.id,
  });

  return NextResponse.json({
    status: 'ok',
    organizationId: timeline.organizationId,
    events: timeline.events,
    hasCommercialActivity: timeline.hasCommercialActivity,
    completeness: timeline.completeness ?? EMPTY_TIMELINE_COMPLETENESS,
  });
}
