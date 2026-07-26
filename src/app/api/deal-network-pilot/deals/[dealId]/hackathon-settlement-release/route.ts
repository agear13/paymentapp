import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/middleware';
import { applyRateLimit } from '@/lib/rate-limit';
import { pilotDealOwnedByUser } from '@/lib/deal-network-demo/pilot-deal-invoice-link.server';
import { markScopedPilotParticipantsPaid } from '@/lib/deal-network-demo/pilot-settlement-release.server';
import { syncCantonSettlementReady } from '@/lib/commercial-network/server/canton-workflow-sync.server';
import { log } from '@/lib/logger';
import {
  orchestrateOperationalMutation,
  operationalSyncJson,
} from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  participantIds: z.array(z.string().min(1)).min(1),
});

function isHackathonSettlementReleaseEnabled(): boolean {
  return process.env.NEXT_PUBLIC_HACKATHON_JOURNEY_ENABLED === 'true';
}

/**
 * POST /api/deal-network-pilot/deals/[dealId]/hackathon-settlement-release
 *
 * Hackathon-only path that persists the same participant payout completion
 * mutation as production batch creation, without payout batch validation.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ dealId: string }> },
) {
  if (!isHackathonSettlementReleaseEnabled()) {
    return NextResponse.json({ error: 'Not available' }, { status: 403 });
  }

  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dealId } = await context.params;
    const id = dealId?.trim();
    if (!id) {
      return NextResponse.json({ error: 'Missing deal id' }, { status: 400 });
    }

    const allowed = await pilotDealOwnedByUser(user.id, id);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const participantIds = [...new Set(parsed.data.participantIds.map((value) => value.trim()))];

    const cantonReady = await syncCantonSettlementReady({ dealId: id });
    if (!cantonReady.ok) {
      log.warn('Canton SettlementReady sync failed before hackathon release', {
        dealId: id,
        error: cantonReady.error,
      });
      return NextResponse.json(
        { error: cantonReady.error ?? 'Canton SettlementReady failed' },
        { status: 409 },
      );
    }

    await markScopedPilotParticipantsPaid(participantIds);

    const operationalSync = await orchestrateOperationalMutation({
      userId: user.id,
      mutation: 'release_batch_generated',
      projectId: id,
    });

    return NextResponse.json({
      ok: true,
      releasedCount: participantIds.length,
      participantIds,
      ...operationalSyncJson(operationalSync),
    });
  } catch (error: unknown) {
    console.error('[deal-network-pilot/hackathon-settlement-release POST]', error);
    return NextResponse.json({ error: 'Failed to release hackathon settlement' }, { status: 500 });
  }
}
