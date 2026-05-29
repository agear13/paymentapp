import { NextResponse } from 'next/server';
import { DealNetworkPilotObligationStatus } from '@prisma/client';
import { requireAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/server/prisma';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { effectiveOnboardingStatus } from '@/lib/deal-network-demo/participant-onboarding';
import {
  createOperationalApiRouteContext,
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

  return runOperationalApiRoute(ctx, async () => {
    try {
      const queryStartedAt = Date.now();
      const user = await requireAuth();
      const dealId = searchParams.get('dealId')?.trim();
      const statusParam = searchParams.get('status')?.trim();
      const participantId = searchParams.get('participantId')?.trim();

      const statusFilter =
        statusParam && PILOT_OBLIGATION_STATUSES.has(statusParam)
          ? (statusParam as DealNetworkPilotObligationStatus)
          : undefined;

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

      logOperationalApiRoutePhase(ctx, {
        phase: 'obligations-query',
        durationMs: Date.now() - queryStartedAt,
        success: true,
        extra: { rowCount: rows.length },
      });

      const data = rows.map((row) => {
        const { participant, ...rest } = row;
        const payload = participant?.participant_payload as Partial<DemoParticipant> | null | undefined;

        if (participant?.name?.toLowerCase().includes('dj alex') && participant.id) {
          const demo = participantRowToDemo({
            id: participant.id,
            deal_id: row.deal_id,
            invite_token: '',
            participant_payload: participant.participant_payload,
          });
          const scope = deriveCommissionScope(demo);
          logParticipantPersistenceFinding({
            correlationId: ctx.correlationId,
            route: ctx.route,
            participantId: participant.id,
            name: participant.name,
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
        }

        const participantOut =
          participant == null
            ? null
            : {
                id: participant.id,
                name: participant.name,
                role: participant.role,
                email: participant.email,
                approvalStatus: payload?.approvalStatus ?? 'Pending approval',
                payoutVerificationConfirmed: payload?.payoutVerificationConfirmed === true,
                compensationProfile: payload?.compensationProfile,
                onboardingStatus: effectiveOnboardingStatus({
                  id: participant.id,
                  onboardingStatus: payload?.onboardingStatus,
                }),
              };
        return { ...rest, participant: participantOut };
      });

      return NextResponse.json({ data });
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      if (err.statusCode === 401) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      console.error('[deal-network-pilot/obligations GET]', e);
      return NextResponse.json({ error: 'Failed to load obligations' }, { status: 500 });
    }
  });
}
