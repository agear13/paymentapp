/**
 * Single Payout Batch API
 * GET /api/payout-batches/[id]
 * DELETE /api/payout-batches/[id] — cancel a DRAFT release only
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
import { canCancelDraftReleaseBatch } from '@/lib/settlement/workspace-settlement';

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

export async function GET(
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

    const { id } = await params;

    const batch = await prisma.payout_batches.findUnique({
      where: { id },
    });

    if (!batch || batch.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const canView = await checkUserPermission(user.id, organizationId, 'view_payment_links');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      data: {
        id: batch.id,
        currency: batch.currency,
        status: batch.status,
        payoutCount: batch.payout_count,
        totalAmount: Number(batch.total_amount),
        createdBy: batch.created_by,
        createdAt: batch.created_at,
        submittedAt: batch.submitted_at,
        completedAt: batch.completed_at,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Cancel a DRAFT release by deleting the batch. Draft payouts cascade-delete;
 * ledger payout_id values SetNull. Pilot obligation rows are left unchanged
 * (still AVAILABLE_FOR_PAYOUT) so overlay no longer marks them Released.
 */
export async function DELETE(
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

    const { id } = await params;

    const canManage = await checkUserPermission(user.id, organizationId, 'manage_ledger');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const batch = await prisma.payout_batches.findUnique({
      where: { id },
      include: { payouts: { select: { id: true, status: true } } },
    });

    if (!batch || batch.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const gate = canCancelDraftReleaseBatch({
      batchStatus: batch.status,
      payoutStatuses: batch.payouts.map((payout) => payout.status),
    });
    if (!gate.ok) {
      return NextResponse.json(
        {
          error:
            gate.code === 'not_draft_batch'
              ? 'Only a draft release can be cancelled.'
              : 'Submitted or paid payouts cannot be cancelled.',
        },
        { status: 400 }
      );
    }

    const payoutIds = batch.payouts.map((payout) => payout.id);

    await prisma.$transaction(async (tx) => {
      if (payoutIds.length > 0) {
        await tx.commission_obligation_lines.updateMany({
          where: { payout_id: { in: payoutIds } },
          data: { payout_id: null, status: 'POSTED', paid_at: null },
        });
        await tx.commission_obligation_items.updateMany({
          where: { payout_id: { in: payoutIds }, status: { not: 'PAID' } },
          data: { payout_id: null },
        });
      }
      await tx.payout_batches.delete({ where: { id } });
    });

    log.info('Draft payout batch cancelled', {
      organizationId,
      batchId: id,
      payoutCount: payoutIds.length,
    });

    return NextResponse.json({
      data: { id, cancelled: true },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
