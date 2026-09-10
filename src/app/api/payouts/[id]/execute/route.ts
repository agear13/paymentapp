/**
 * Execute a submitted payout on its stamped rail.
 * POST /api/payouts/[id]/execute
 *
 * Adapter submit only. Canonical status is applied by executePayoutRelease().
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { isBetaAdminEmail } from '@/lib/auth/admin-shared';
import { applyRateLimit } from '@/lib/rate-limit';
import { extractRequestAuditContext } from '@/lib/audit/request-context.server';
import { executePayoutRelease } from '@/lib/payouts/execute-payout-release.server';
import { PayoutReleaseError } from '@/lib/payouts/payout-status-transitions';
import { preflightCregisPayout } from '@/lib/payouts/rails/cregis-preflight.server';

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
    const payout = await prisma.payouts.findUnique({ where: { id } });
    if (!payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }

    const canManage = await checkUserPermission(user.id, payout.organization_id, 'manage_ledger');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (payout.rail_id === 'cregis') {
      const readiness = await preflightCregisPayout({
        organizationId: payout.organization_id,
        payoutId: id,
        queryProjectCoins: true,
      });
      if (!readiness.executable) {
        return NextResponse.json(
          {
            error: 'Cregis payout is not executable',
            code: 'CREGIS_NOT_EXECUTABLE',
            reasons: readiness.reasons,
            readiness,
          },
          { status: 409 }
        );
      }
    }

    const auditCtx = extractRequestAuditContext(request);
    const result = await executePayoutRelease({
      type: 'execute',
      payoutId: id,
      actor: {
        userId: user.id,
        organizationId: payout.organization_id,
        ipAddress: auditCtx.ipAddress,
        userAgent: auditCtx.userAgent,
        correlationId: auditCtx.correlationId,
      },
    });

    return NextResponse.json({
      data: {
        id: payout.id,
        railId: payout.rail_id,
        status: result.statuses[0] ?? payout.status,
      },
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
