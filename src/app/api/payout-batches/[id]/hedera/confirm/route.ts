/**
 * POST /api/payout-batches/[id]/hedera/confirm
 * Verifies Hedera transaction then marks only the payouts included in the tx as PAID.
 *
 * NOTE: This API is restricted to beta admins during BETA_LOCKDOWN_MODE
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { checkUserPermission } from '@/lib/auth/permissions';
import { isBetaAdminEmail } from '@/lib/auth/admin-shared';
import { applyRateLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { z } from 'zod';
import {
  orchestrateOperationalMutation,
  operationalSyncJson,
} from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';
import { extractRequestAuditContext } from '@/lib/audit/request-context.server';
import { executePayoutRelease } from '@/lib/payouts/execute-payout-release.server';
import {
  hederaPaidEvents,
  syncHederaMirrorTransaction,
} from '@/lib/payouts/rails/hedera.adapter';
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

const ConfirmSchema = z.object({
  transactionId: z.string().regex(/^0\.0\.\d+[@-]\d+\.\d+$/),
  includedPayoutIds: z
    .array(z.string().uuid())
    .min(1, 'includedPayoutIds is required and must have at least one payout id'),
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

    const org = await getOrganizationForAuthenticatedUser(user.id);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    const organizationId = org.id;

    const { id: batchId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = ConfirmSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      const msg =
        issues.map((e: { message: string }) => e.message).join('; ') ||
        'transactionId and includedPayoutIds required';
      return NextResponse.json({ error: msg, details: issues }, { status: 400 });
    }

    const { transactionId, includedPayoutIds } = parsed.data;

    const canManage = await checkUserPermission(user.id, organizationId, 'manage_ledger');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const batch = await prisma.payout_batches.findUnique({
      where: { id: batchId },
      include: {
        payouts: {
          where: { status: { notIn: ['PAID', 'FAILED'] } },
          select: { id: true, rail_id: true },
        },
      },
    });

    if (!batch || batch.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const unpaidIds = new Set(
      batch.payouts.filter((payout) => payout.rail_id === 'hedera').map((payout) => payout.id)
    );
    if (unpaidIds.size === 0) {
      return NextResponse.json(
        { error: 'No unpaid Hedera payouts in this batch; nothing to confirm' },
        { status: 400 }
      );
    }

    for (const id of includedPayoutIds) {
      if (!unpaidIds.has(id)) {
        return NextResponse.json(
          {
            error: 'One or more includedPayoutIds do not belong to this batch or are already PAID',
            invalidPayoutId: id,
          },
          { status: 400 }
        );
      }
    }

    const mirror = await syncHederaMirrorTransaction(transactionId);
    if (!mirror.ok) {
      const status = mirror.httpStatus === 404 || mirror.result == null ? 404 : 400;
      return NextResponse.json(
        {
          error: mirror.result
            ? `Transaction failed with result: ${mirror.result}`
            : 'Transaction not found or not yet indexed on Hedera',
          status: mirror.httpStatus,
        },
        { status }
      );
    }

    const auditCtx = extractRequestAuditContext(request);
    await executePayoutRelease({
      type: 'apply_events',
      events: hederaPaidEvents({
        payoutIds: includedPayoutIds,
        providerReference: mirror.providerReference,
      }),
      actor: {
        userId: user.id,
        organizationId,
        ipAddress: auditCtx.ipAddress,
        userAgent: auditCtx.userAgent,
        correlationId: auditCtx.correlationId,
      },
    });

    log.info('Payout batch confirmed and marked PAID (Hedera)', {
      batchId,
      organizationId,
      transactionId: mirror.providerReference,
      payoutCount: includedPayoutIds.length,
    });

    const operationalSync = await orchestrateOperationalMutation({
      userId: user.id,
      mutation: 'payout_released',
    });

    return NextResponse.json({
      data: {
        batchId,
        transactionId: mirror.providerReference.replace(/^hedera:/, ''),
        payoutIds: includedPayoutIds,
        status: 'PAID',
      },
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
