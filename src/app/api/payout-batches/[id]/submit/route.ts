/**
 * Submit Payout Batch API
 * POST /api/payout-batches/[id]/submit
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
import { loggers } from '@/lib/logger';
import {
  orchestrateOperationalMutation,
  operationalSyncJson,
} from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';
import { extractRequestAuditContext } from '@/lib/audit/request-context.server';
import { executePayoutRelease } from '@/lib/payouts/execute-payout-release.server';
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

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const externalReference = (body as { external_reference?: string }).external_reference;

    const batch = await prisma.payout_batches.findUnique({
      where: { id },
      include: { payouts: true },
    });

    if (!batch || batch.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const canManage = await checkUserPermission(user.id, organizationId, 'manage_ledger');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const auditCtx = extractRequestAuditContext(request);
    const result = await executePayoutRelease({
      type: 'submit_batch',
      batchId: id,
      actor: {
        userId: user.id,
        organizationId,
        ipAddress: auditCtx.ipAddress,
        userAgent: auditCtx.userAgent,
        correlationId: auditCtx.correlationId,
      },
    });

    loggers.payment.info('Payout batch submitted', {
      userId: user.id,
      organizationId,
      batchId: id,
      externalReference,
    });

    const operationalSync = await orchestrateOperationalMutation({
      userId: user.id,
      mutation: 'release_batch_generated',
    });

    return NextResponse.json({
      data: {
        id: batch.id,
        status: result.batchStatus ?? 'SUBMITTED',
        submittedAt: new Date(),
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
