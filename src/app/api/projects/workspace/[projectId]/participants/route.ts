import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { getProjectWorkspaceParticipantsForUser } from '@/lib/projects/workspace.server';

export const dynamic = 'force-dynamic';

/** GET — project-scoped participants slice (no full deals payload). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId } = await context.params;
    const result = await getProjectWorkspaceParticipantsForUser(user.id, projectId);

    if (!result.found) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({
      participants: result.participants,
      projectParticipants: result.projectParticipants,
    });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[projects/workspace/participants GET]', e);
    return NextResponse.json({ error: 'Failed to load participants' }, { status: 500 });
  }
}
