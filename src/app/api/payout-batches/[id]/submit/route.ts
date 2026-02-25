/**
 * Submit Payout Batch API
 * POST /api/payout-batches/[id]/submit
 * 
 * NOTE: This API is restricted to beta admins during BETA_LOCKDOWN_MODE
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { isBetaAdminEmail } from '@/lib/auth/admin-shared';
import { applyRateLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';

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
    const externalReference = (body as { external_reference?: string }).external_reference;

    const batch = await prisma.payout_batches.findUnique({
      where: { id },
      include: { payouts: true },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const canManage = await checkUserPermission(user.id, batch.organization_id, 'manage_ledger');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (batch.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `Batch is already ${batch.status}` },
        { status: 400 }
      );
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.payout_batches.update({
        where: { id },
        data: { status: 'SUBMITTED', submitted_at: now },
      });
      await tx.payouts.updateMany({
        where: { batch_id: id },
        data: { status: 'SUBMITTED' },
      });
    });

    log.info(
      { organizationId: batch.organization_id, batchId: id, externalReference },
      'Payout batch submitted'
    );

    return NextResponse.json({
      data: { id: batch.id, status: 'SUBMITTED', submittedAt: now },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
