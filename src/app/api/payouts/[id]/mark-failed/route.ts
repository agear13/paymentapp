/**
 * Mark Payout Failed API
 * POST /api/payouts/[id]/mark-failed
 * Unassigns obligation lines (payout_id = null) so they can be re-batched
 *
 * NOTE: This API is restricted to beta admins during BETA_LOCKDOWN_MODE
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { isBetaAdminEmail } from '@/lib/auth/admin-shared';
import { applyRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import {
  orchestrateOperationalMutation,
  operationalSyncJson,
} from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';
import { extractRequestAuditContext } from '@/lib/audit/request-context.server';
import { executePayoutRelease } from '@/lib/payouts/execute-payout-release.server';
import { buildManualFailedEvent } from '@/lib/payouts/rails/manual.adapter';
import { PayoutReleaseError } from '@/lib/payouts/payout-status-transitions';

function checkBetaLockdown(userEmail?: string | null): NextResponse | null {
  const betaLockdownEnabled = process.env.BETA_LOCKDOWN_MODE !== 'false';
  if (betaLockdownEnabled && !isBetaAdminEmail(userEmail)) {
    return NextResponse.json(
      { error: 'Forbidden: This feature is restricted during beta' },
      { status: 403 }
    );
  }
  return null;
}

const MarkFailedSchema = z.object({
  failed_reason: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;
    const { user } = auth;

    const lockdownResponse = checkBetaLockdown(user.email);
    if (lockdownResponse) return lockdownResponse;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = MarkFailedSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'failed_reason is required', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const payout = await prisma.payouts.findUnique({
      where: { id },
    });

    if (!payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }

    const canManage = await checkUserPermission(user.id, payout.organization_id, 'manage_ledger');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const auditCtx = extractRequestAuditContext(request);
    const result = await executePayoutRelease({
      type: 'apply_event',
      event: buildManualFailedEvent({
        payoutId: id,
        failedReason: parsed.data.failed_reason,
      }),
      actor: {
        userId: user.id,
        organizationId: payout.organization_id,
        ipAddress: auditCtx.ipAddress,
        userAgent: auditCtx.userAgent,
        correlationId: auditCtx.correlationId,
      },
    });

    const operationalSync = await orchestrateOperationalMutation({
      userId: user.id,
      mutation: 'payout_released',
    });

    return NextResponse.json({
      data: { id: payout.id, status: result.statuses[0] ?? 'FAILED' },
      message: 'Obligation lines unassigned for re-batching',
      ...operationalSyncJson(operationalSync),
    });
  } catch (error: unknown) {
    if (error instanceof PayoutReleaseError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.httpStatus }
      );
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
