import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { getProjectWorkspaceParticipantsForUser } from '@/lib/projects/workspace.server';
import {
  approvalTraceFields,
  traceRuntime,
  watchParticipantAcceptedTransition,
} from '@/lib/operations/dev/participant-accepted-runtime-trace';

export const dynamic = 'force-dynamic';

/** GET — project-scoped participants slice (no full deals payload). */
export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { projectId } = await context.params;
    traceRuntime('HTTP request', {
      url: request.url,
      method: request.method,
      projectId,
      body: null,
    });
    const result = await getProjectWorkspaceParticipantsForUser(user.id, projectId);

    if (!result.found) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const responseBody = {
      participants: result.participants,
      projectParticipants: result.projectParticipants,
    };
    responseBody.projectParticipants.forEach((participant) => {
      watchParticipantAcceptedTransition(
        'GET /api/projects/workspace/[projectId]/participants response',
        participant
      );
    });
    traceRuntime('HTTP response', {
      url: request.url,
      method: request.method,
      projectId,
      body: responseBody,
      participantsApprovalFields: responseBody.projectParticipants.map(approvalTraceFields),
    });

    return NextResponse.json(responseBody);
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[projects/workspace/participants GET]', e);
    return NextResponse.json({ error: 'Failed to load participants' }, { status: 500 });
  }
}
