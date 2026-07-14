import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth/admin.server';
import { collectPilotReadinessSnapshot } from '@/lib/pilot/pilot-readiness.server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pilot/status?organization_id=xxx
 * Admin-only pilot command centre data.
 */
export async function GET(request: NextRequest) {
  const admin = await checkAdminAuth();
  if (!admin.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organization_id');

  const snapshot = await collectPilotReadinessSnapshot(organizationId);

  return NextResponse.json({ success: true, data: snapshot });
}
