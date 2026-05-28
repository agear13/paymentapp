import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { deriveAuditTimelineFromGraph } from '@/lib/operations/audit/derive-audit-timeline-from-state';
import { resolveOperationalCoordinationSnapshot } from '@/lib/operations/selectors/resolve-operational-coordination.server';
import { resolveOperationalInitializationSnapshot } from '@/lib/operations/onboarding/run-operational-initialization-convergence.server';
import { listOperationalTransitions } from '@/lib/operations/onboarding/persist-operational-transition.server';
import { mergeInitializationAuditTimeline } from '@/lib/operations/audit/derive-audit-timeline-from-transitions';

export const dynamic = 'force-dynamic';

/** GET /api/operations/coordination-snapshot?projectId= — authoritative operational graph */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const org = await getOrganizationForAuthenticatedUser(user.id);
    const onboarding = org
      ? await resolveOperationalInitializationSnapshot({
          userId: user.id,
          organizationId: org.id,
        })
      : null;

    const { searchParams } = new URL(request.url);
    const projectId =
      searchParams.get('projectId')?.trim() ||
      onboarding?.onboarding.primaryProjectId ||
      undefined;

    const graph = await resolveOperationalCoordinationSnapshot({
      userId: user.id,
      projectId,
    });

    const persistedEntityAuthoritative = graph.summary.participantCount > 0;
    const graphReady =
      persistedEntityAuthoritative || (onboarding?.graphReady ?? true);

    const transitions = org
      ? await listOperationalTransitions({
          organizationId: org.id,
          correlationId: onboarding?.correlationId,
        })
      : [];
    const auditTimeline = mergeInitializationAuditTimeline(
      deriveAuditTimelineFromGraph(graph, graph.projectId ?? undefined),
      transitions
    );

    return NextResponse.json({
      data: {
        graphReady,
        operationalOnboarding: onboarding?.onboarding,
        operationalInitialization: onboarding ?? undefined,
        correlationId: onboarding?.correlationId,
        summary: graph.summary,
        funding: graph.funding,
        obligationCount: graph.obligations.length,
        auditTimeline,
        projectCurrency: graph.projectCurrency,
        participants: graph.participants,
        participantDiagnostics: graph.participants.map((p) => ({
          participantId: p.participant.id,
          name: p.participant.name,
          agreementApproval: p.agreementApproval,
          payoutReady: p.payoutReadiness.payoutReady,
          releaseReady: p.readinessHierarchy?.release?.ready ?? false,
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
