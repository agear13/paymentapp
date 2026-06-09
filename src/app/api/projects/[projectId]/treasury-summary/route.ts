import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { getProjectTreasurySummaryForUser } from '@/lib/projects/funding-sources/funding-sources.server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { projectId } = await context.params;
    const summary = await getProjectTreasurySummaryForUser(user.id, projectId);
    if (!summary) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ data: summary });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[projects/treasury-summary GET]', e);
    return NextResponse.json({ error: 'Failed to load treasury summary' }, { status: 500 });
  }
}
