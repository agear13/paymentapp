import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { deriveAuditTimelineFromGraph } from '@/lib/operations/audit/derive-audit-timeline-from-state';
import { resolveOperationalCoordinationSnapshot } from '@/lib/operations/selectors/resolve-operational-coordination.server';

export const dynamic = 'force-dynamic';

/** GET /api/operations/coordination-snapshot?projectId= — authoritative operational graph */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId')?.trim() || undefined;

    const graph = await resolveOperationalCoordinationSnapshot({
      userId: user.id,
      projectId,
    });

    const auditTimeline = deriveAuditTimelineFromGraph(graph, graph.projectId ?? undefined);

    return NextResponse.json({
      data: {
        summary: graph.summary,
        funding: graph.funding,
        obligationCount: graph.obligations.length,
        auditTimeline,
        projectCurrency: graph.projectCurrency,
        participants: graph.participants.map((p) => ({
          participantId: p.participant.id,
          name: p.participant.name,
          agreementApproval: p.agreementApproval,
          payoutReady: p.payoutReadiness.payoutReady,
          releaseReady: p.readinessHierarchy.release.ready,
          readinessHierarchy: p.readinessHierarchy,
          blockers: p.blockers,
        })),
      },
    });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[operations/coordination-snapshot GET]', e);
    return NextResponse.json({ error: 'Failed to load operational graph' }, { status: 500 });
  }
}
