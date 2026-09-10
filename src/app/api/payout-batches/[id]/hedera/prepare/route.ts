/**
 * POST /api/payout-batches/[id]/hedera/prepare
 * Builds a Hedera HTS transfer from merchant to Hedera-rail payees; returns frozen tx as base64.
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
import {
  executePayoutRelease,
  listCanonicalPayoutInstructionsForBatch,
  toCanonicalPayoutInstruction,
} from '@/lib/payouts/execute-payout-release.server';
import { getPayoutRailAdapter } from '@/lib/payouts/rails/adapters';
import {
  hederaDestinationsByPayoutId,
} from '@/lib/payouts/rails/hedera.adapter';
import { PayoutReleaseError } from '@/lib/payouts/payout-status-transitions';
import { extractRequestAuditContext } from '@/lib/audit/request-context.server';

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

    const { id: batchId } = await params;

    const canManage = await checkUserPermission(user.id, organizationId, 'manage_ledger');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const batch = await prisma.payout_batches.findUnique({
      where: { id: batchId },
      include: {
        payouts: {
          include: { payout_methods: true },
        },
        organizations: {
          include: { merchant_settings: { select: { hedera_account_id: true } } },
        },
      },
    });

    if (!batch || batch.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const hederaRows = batch.payouts.filter((payout) => payout.rail_id === 'hedera');
    const instructions = hederaRows.length
      ? hederaRows.map(toCanonicalPayoutInstruction)
      : (await listCanonicalPayoutInstructionsForBatch(batchId)).filter(
          (instruction) => instruction.railId === 'hedera'
        );

    const adapter = getPayoutRailAdapter('hedera');
    const prepared = await adapter.prepareGroup!(instructions, {
      merchantHederaAccountId: batch.organizations?.merchant_settings?.[0]?.hedera_account_id,
      hederaDestinationsByPayoutId: hederaDestinationsByPayoutId(hederaRows),
    });

    const auditCtx = extractRequestAuditContext(request);
    await executePayoutRelease({
      type: 'mark_processing',
      payoutIds: prepared.payoutIds,
      providerPayload: prepared.providerPayload,
      actor: {
        userId: user.id,
        organizationId,
        ipAddress: auditCtx.ipAddress,
        userAgent: auditCtx.userAgent,
        correlationId: auditCtx.correlationId,
      },
    });

    return NextResponse.json({
      data: {
        ...prepared.providerPayload,
        includedPayoutIds: prepared.payoutIds,
        batchId,
      },
    });
  } catch (error: unknown) {
    if (error instanceof PayoutReleaseError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details, ...error.details },
        { status: error.httpStatus }
      );
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
