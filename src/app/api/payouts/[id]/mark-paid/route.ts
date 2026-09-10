/**
 * Mark Payout Paid API
 * POST /api/payouts/[id]/mark-paid
 * Idempotent: if already PAID, returns 200
 *
 * NOTE: This API is restricted to beta admins during BETA_LOCKDOWN_MODE
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { isBetaAdminEmail } from '@/lib/auth/admin-shared';
import { applyRateLimit } from '@/lib/rate-limit';
import {
  orchestrateOperationalMutation,
  operationalSyncJson,
} from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';
import { z } from 'zod';
import { extractRequestAuditContext } from '@/lib/audit/request-context.server';
import { executePayoutRelease } from '@/lib/payouts/execute-payout-release.server';
import { buildManualPaidEvent } from '@/lib/payouts/rails/manual.adapter';
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

const MarkPaidSchema = z.object({
  external_reference: z.string().min(1),
  paid_at: z.string().optional(),
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
    const parsed = MarkPaidSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'external_reference is required', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { external_reference, paid_at } = parsed.data;

    const payout = await prisma.payouts.findUnique({
      where: { id },
      include: { obligation_lines: true },
    });

    if (!payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }

    const canManage = await checkUserPermission(user.id, payout.organization_id, 'manage_ledger');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const paidAtDate = paid_at ? new Date(paid_at) : new Date();
    const auditCtx = extractRequestAuditContext(request);
    const result = await executePayoutRelease({
      type: 'apply_event',
      event: buildManualPaidEvent({
        payoutId: id,
        externalReference: external_reference,
        paidAt: paidAtDate,
      }),
      actor: {
        userId: user.id,
        organizationId: payout.organization_id,
        ipAddress: auditCtx.ipAddress,
        userAgent: auditCtx.userAgent,
        correlationId: auditCtx.correlationId,
      },
    });

    const alreadyPaid = payout.status === 'PAID';
    const pilotParticipant = await prisma.deal_network_pilot_participants.findUnique({
      where: { id: payout.user_id },
      include: { deal: true },
    });

    const operationalSync = await orchestrateOperationalMutation({
      userId: pilotParticipant?.deal.user_id ?? user.id,
      mutation: 'payout_released',
      projectId: pilotParticipant?.deal_id,
    });

    return NextResponse.json({
      data: {
        id: payout.id,
        status: result.statuses[0] ?? 'PAID',
        paidAt: paidAtDate,
      },
      ...(alreadyPaid ? { message: 'Already marked as paid (idempotent)' } : {}),
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
