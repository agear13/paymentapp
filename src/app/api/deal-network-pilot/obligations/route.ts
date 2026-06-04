import { NextResponse } from 'next/server';
import { DealNetworkPilotObligationStatus, type Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { prisma } from '@/lib/server/prisma';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { effectiveOnboardingStatus } from '@/lib/deal-network-demo/participant-onboarding';
import { serializePilotObligationApiRow } from '@/lib/deal-network-demo/serialize-pilot-obligation-api-row';
import {
  createOperationalApiRouteContext,
  getOperationalApiDbQueryCount,
  logOperationalApiRoutePhase,
  logParticipantPersistenceFinding,
  runOperationalApiRoute,
} from '@/lib/operations/dev/api-route-diagnostics.server';
import { hasPersistedCompensationTerms } from '@/lib/operations/primitives/participant-earnings-primitives';
import { participantRowToDemo } from '@/lib/deal-network-demo/pilot-snapshot.server';
import { deriveCommissionScope } from '@/lib/operations/derivations/commission-scope';

export const dynamic = 'force-dynamic';

const PILOT_OBLIGATION_STATUSES = new Set<string>(
  Object.values(DealNetworkPilotObligationStatus)
);

function logParticipantEarningsFailure(input: {
  stage: string;
  obligationCount?: number;
  participantId?: string | null;
  dealId?: string | null;
  error: unknown;
}) {
  console.error('[PARTICIPANT_EARNINGS_FAILURE]', {
    stage: input.stage,
    obligationCount: input.obligationCount ?? null,
    participantId: input.participantId ?? null,
    dealId: input.dealId ?? null,
    error:
      input.error instanceof Error
        ? { name: input.error.name, message: input.error.message, stack: input.error.stack }
        : String(input.error),
  });
}

function obligationsDegradedResponse(
  ctx: ReturnType<typeof createOperationalApiRouteContext>,
  input: { errorMessage: string; status?: number }
) {
  return NextResponse.json(
    {
      data: [],
      degraded: true,
      correlationId: ctx.correlationId,
      requestId: ctx.requestId,
      errorMessage: input.errorMessage,
    },
    { status: input.status ?? 200 }
  );
}

function mapParticipantOut(
  participant: {
    id: string;
    name: string;
    role: string;
    email: string | null;
    participant_payload: Prisma.JsonValue;
  } | null
): Record<string, unknown> | null {
  if (participant == null) return null;
  const payload = participant.participant_payload as Partial<DemoParticipant> | null | undefined;
  return {
    id: participant.id,
    name: participant.name,
    role: participant.role,
    email: participant.email,
    approvalStatus: payload?.approvalStatus ?? 'Pending approval',
    payoutVerificationConfirmed: payload?.payoutVerificationConfirmed === true,
    compensationProfile: payload?.compensationProfile ?? null,
    onboardingStatus: effectiveOnboardingStatus({
      id: participant.id,
      onboardingStatus: payload?.onboardingStatus,
    }),
  };
}

function logDjAlexPersistenceFinding(
  ctx: ReturnType<typeof createOperationalApiRouteContext>,
  row: {
    deal_id: string;
    participant: {
      id: string;
      name: string;
      participant_payload: Prisma.JsonValue;
    };
  }
): void {
  try {
    const payload = row.participant.participant_payload as Partial<DemoParticipant> | null | undefined;
    const demo = participantRowToDemo({
      id: row.participant.id,
      deal_id: row.deal_id,
      invite_token: '',
      participant_payload: row.participant.participant_payload,
    });
    const scope = deriveCommissionScope(demo);
    logParticipantPersistenceFinding({
      correlationId: ctx.correlationId,
      route: ctx.route,
      participantId: row.participant.id,
      name: row.participant.name,
      compensationProfileExists: payload?.compensationProfile != null,
      configuredAt:
        (payload?.compensationProfile as { configuredAt?: string } | undefined)?.configuredAt ??
        null,
      earningsStructure: {
        settlementBasis: scope.settlementBasis,
        earningsPrimary: scope.earningsPrimary,
        earningsPrimaryCompact: scope.earningsPrimary,
      },
      hasPersistedCompensationTerms: hasPersistedCompensationTerms(demo),
    });
  } catch (error) {
    logParticipantEarningsFailure({
      stage: 'dj-alex-persistence-finding',
      participantId: row.participant.id,
      dealId: row.deal_id,
      error,
    });
  }
}

/**
 * GET /api/deal-network-pilot/obligations?dealId=&status=&participantId=
 * Lists derived obligation rows for the authenticated pilot user (read-only).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ctx = createOperationalApiRouteContext({
    route: '/api/deal-network-pilot/obligations',
    request,
    projectId: searchParams.get('dealId')?.trim() || null,
  });

  try {
    return await runOperationalApiRoute(ctx, async () => {
      const routeStartedAt = Date.now();
      let organizationId: string | null = null;

      try {
        const authStartedAt = Date.now();
        const user = await requireAuth();
        const org = await getOrganizationForAuthenticatedUser(user.id).catch(() => null);
        organizationId = org?.id ?? null;

        logOperationalApiRoutePhase(ctx, {
          phase: 'auth',
          durationMs: Date.now() - authStartedAt,
          success: true,
          extra: { organizationId, userId: user.id },
        });

        const dealId = searchParams.get('dealId')?.trim();
        const statusParam = searchParams.get('status')?.trim();
        const participantId = searchParams.get('participantId')?.trim();

        const statusFilter =
          statusParam && PILOT_OBLIGATION_STATUSES.has(statusParam)
            ? (statusParam as DealNetworkPilotObligationStatus)
            : undefined;

        try {
          const queryStartedAt = Date.now();
          const rows = await prisma.deal_network_pilot_obligations.findMany({
            where: {
              user_id: user.id,
              ...(dealId ? { deal_id: dealId } : {}),
              ...(statusFilter ? { status: statusFilter } : {}),
              ...(participantId ? { participant_id: participantId } : {}),
            },
            orderBy: [{ deal_id: 'asc' }, { created_at: 'asc' }],
            include: {
              deal: {
                select: { id: true, name: true, partner: true },
              },
              participant: {
                select: { id: true, name: true, role: true, email: true, participant_payload: true },
              },
              payment_event: {
                select: {
                  id: true,
                  source_type: true,
                  payment_link_id: true,
                  event_type: true,
                  gross_amount: true,
                  amount_received: true,
                  currency_received: true,
                  received_at: true,
                },
              },
            },
          });
          const prismaDurationMs = Date.now() - queryStartedAt;

          logOperationalApiRoutePhase(ctx, {
            phase: 'obligations-query',
            durationMs: prismaDurationMs,
            success: true,
            dbQueryCount: getOperationalApiDbQueryCount(),
            extra: {
              rowCount: rows.length,
              organizationId,
              projectId: dealId ?? ctx.projectId,
              prismaDurationMs,
            },
          });

          const mapStartedAt = Date.now();
          const data: Record<string, unknown>[] = [];

          for (const row of rows) {
            try {
              if (row.participant?.name?.toLowerCase().includes('dj alex') && row.participant.id) {
                logDjAlexPersistenceFinding(ctx, {
                  deal_id: row.deal_id,
                  participant: row.participant,
                });
              }

              const participantOut = mapParticipantOut(row.participant);
              data.push(serializePilotObligationApiRow(row, participantOut));
            } catch (error) {
              logParticipantEarningsFailure({
                stage: 'response-mapping',
                obligationCount: rows.length,
                participantId: row.participant_id,
                dealId: row.deal_id,
                error,
              });
            }
          }

          logOperationalApiRoutePhase(ctx, {
            phase: 'obligations-map',
            durationMs: Date.now() - mapStartedAt,
            success: true,
            extra: {
              mappedRowCount: data.length,
              sourceRowCount: rows.length,
              totalDurationMs: Date.now() - routeStartedAt,
              organizationId,
            },
          });

          try {
            return NextResponse.json({ data, correlationId: ctx.correlationId });
          } catch (error) {
            logParticipantEarningsFailure({
              stage: 'response-serialization',
              obligationCount: data.length,
              error,
            });
            return obligationsDegradedResponse(ctx, {
              errorMessage:
                error instanceof Error
                  ? error.message
                  : 'Obligation response could not be serialized.',
            });
          }
        } catch (error) {
          logParticipantEarningsFailure({
            stage: 'query-execution',
            dealId: dealId ?? null,
            participantId: participantId ?? null,
            error,
          });
          throw error;
        }

      } catch (e: unknown) {
        const err = e as { statusCode?: number; message?: string; name?: string };
        if (err.statusCode === 401) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        logOperationalApiRoutePhase(ctx, {
          phase: 'obligations-error',
          failure: true,
          success: false,
          durationMs: Date.now() - routeStartedAt,
          dbQueryCount: getOperationalApiDbQueryCount(),
          errorMessage: err.message ?? String(e),
          extra: {
            organizationId,
            projectId: ctx.projectId,
            errorName: err.name ?? 'UnknownError',
            stack: e instanceof Error ? e.stack : undefined,
          },
        });

        logParticipantEarningsFailure({
          stage: 'route-handler',
          error: e,
        });

        console.error('[deal-network-pilot/obligations GET]', e);

        return obligationsDegradedResponse(ctx, {
          errorMessage:
            err.message ??
            'Obligations could not be loaded. The workspace remains available in degraded mode.',
        });
      }
    });
  } catch (error) {
    logParticipantEarningsFailure({
      stage: 'operational-api-route-wrapper',
      error,
    });
    return obligationsDegradedResponse(ctx, {
      errorMessage:
        error instanceof Error
          ? error.message
          : 'Obligations route failed before a response could be returned.',
    });
  }
}
