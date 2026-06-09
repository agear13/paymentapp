import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { getProjectWorkspaceSummaryForUser } from '@/lib/projects/workspace.server';

export const dynamic = 'force-dynamic';

/** GET — lightweight project shell: deal metadata + summary metrics only. */
export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { projectId } = await context.params;
    const result = await getProjectWorkspaceSummaryForUser(user.id, projectId);

    if (!result.found) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({
      deal: result.deal,
      summary: result.summary,
      participantCount: result.participantCount,
      deals: result.deals,
    });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[projects/workspace/summary GET]', e);
    return NextResponse.json({ error: 'Failed to load project summary' }, { status: 500 });
  }
}
