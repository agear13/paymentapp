import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import { deriveAuditTimelineFromGraph } from '@/lib/operations/audit/derive-audit-timeline-from-state';
import { resolveOperationalCoordinationSnapshot } from '@/lib/operations/selectors/resolve-operational-coordination.server';
import { resolveOperationalInitializationSnapshot } from '@/lib/operations/onboarding/run-operational-initialization-convergence.server';
import { listOperationalTransitions } from '@/lib/operations/onboarding/persist-operational-transition.server';
import { mergeInitializationAuditTimeline } from '@/lib/operations/audit/derive-audit-timeline-from-transitions';
import { mergeConversationImportAuditTimeline } from '@/lib/operations/audit/conversation-import-audit';
import {
  createOperationalApiRouteContext,
  logOperationalApiRoutePhase,
  logParticipantPersistenceFinding,
  runOperationalApiRoute,
} from '@/lib/operations/dev/api-route-diagnostics.server';
import { buildParticipantEarningsPersistenceDiagnostic } from '@/lib/operations/dev/participant-earnings-persistence-diagnostic';
import {
  logOnboardingPipelineDemoParticipants,
  logOnboardingPipelineDiagnostic,
} from '@/lib/ai-extractor/onboarding-pipeline-instrumentation';

export const dynamic = 'force-dynamic';

/** GET /api/operations/coordination-snapshot?projectId= — authoritative operational graph */
export async function GET(request: Request) {
  const ctx = createOperationalApiRouteContext({
    route: '/api/operations/coordination-snapshot',
    request,
  });

  return runOperationalApiRoute(ctx, async () => {
    try {
      const user = await requireAuth();
      const org = await getOrganizationForAuthenticatedUser(user.id);
      const { searchParams } = new URL(request.url);
      const includeInitialization = searchParams.get('includeInitialization') === 'true';

      const pilotStartedAt = Date.now();
      const pilotSnapshot = await getPilotSnapshotForUser(user.id).catch(() => ({
        deals: [],
        participants: [],
      }));
      logOperationalApiRoutePhase(ctx, {
        phase: 'pilot-snapshot',
        durationMs: Date.now() - pilotStartedAt,
        success: true,
      });

      let initializationDurationMs = 0;
      const onboarding =
        org && includeInitialization
          ? await (async () => {
              const initStartedAt = Date.now();
              const init = await resolveOperationalInitializationSnapshot({
                userId: user.id,
                organizationId: org.id,
              });
              initializationDurationMs = Date.now() - initStartedAt;
              logOperationalApiRoutePhase(ctx, {
                phase: 'initialization',
                durationMs: initializationDurationMs,
                initializationDurationMs,
                success: true,
                extra: { includeInitialization: true },
              });
              return init;
            })()
          : null;

      const projectId =
        searchParams.get('projectId')?.trim() ||
        onboarding?.onboarding.primaryProjectId ||
        pilotSnapshot.deals[0]?.id ||
        undefined;

      ctx.projectId = projectId ?? null;

      const graphStartedAt = Date.now();
      const graph = await resolveOperationalCoordinationSnapshot({
        userId: user.id,
        projectId,
      });
      const graphBuildDurationMs = Date.now() - graphStartedAt;
      logOperationalApiRoutePhase(ctx, {
        phase: 'graph-build',
        durationMs: graphBuildDurationMs,
        graphBuildDurationMs,
        initializationDurationMs,
        success: true,
        extra: { includeInitialization },
      });

      const persistedEntityAuthoritative = graph.summary.participantCount > 0;
      const graphReady =
        persistedEntityAuthoritative || (onboarding?.graphReady ?? persistedEntityAuthoritative);

      const transitionsStartedAt = Date.now();
      const transitions = org
        ? await listOperationalTransitions({
            organizationId: org.id,
            correlationId: onboarding?.correlationId,
          })
        : [];
      logOperationalApiRoutePhase(ctx, {
        phase: 'transitions',
        durationMs: Date.now() - transitionsStartedAt,
        success: true,
      });

      const auditTimeline = mergeInitializationAuditTimeline(
        mergeConversationImportAuditTimeline(
          deriveAuditTimelineFromGraph(graph, graph.projectId ?? undefined),
          pilotSnapshot.deals,
          graph.projectId ?? undefined
        ),
        transitions
      );

      for (const row of graph.participants) {
        logOnboardingPipelineDemoParticipants('coordinationSnapshotParticipant', [row.participant], {
          projectId: projectId ?? null,
          route: ctx.route,
        });
      }

      const participantDiagnostics = graph.participants.map((p) => {
        const diagnostic = buildParticipantEarningsPersistenceDiagnostic(p.participant);
        logOnboardingPipelineDiagnostic('participantDiagnosticsInput', diagnostic, {
          projectId: projectId ?? null,
          route: ctx.route,
        });
        logParticipantPersistenceFinding({
          correlationId: ctx.correlationId,
          route: ctx.route,
          participantId: diagnostic.participantId,
          name: diagnostic.name,
          compensationProfileExists: diagnostic.compensationProfileFound,
          configuredAt: diagnostic.configuredAt,
          earningsStructure: diagnostic.earningsStructure,
          hasPersistedCompensationTerms: diagnostic.selectorResult.hasPersistedCompensationTerms,
        });
        return {
          ...diagnostic,
          agreementApproval: p.agreementApproval,
          payoutReady: p.payoutReadiness.payoutReady,
          releaseReady: p.readinessHierarchy?.release?.ready ?? false,
        };
      });

      return NextResponse.json({
        data: {
          graphReady,
          operationalOnboarding: onboarding?.onboarding,
          operationalInitialization: onboarding ?? undefined,
          correlationId: onboarding?.correlationId ?? ctx.correlationId,
          summary: graph.summary,
          funding: graph.funding,
          obligationCount: graph.obligations.length,
          auditTimeline,
          projectCurrency: graph.projectCurrency,
          participants: graph.participants,
          participantDiagnostics,
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
  });
}
