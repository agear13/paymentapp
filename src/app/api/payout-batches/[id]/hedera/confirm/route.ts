/**
 * POST /api/payout-batches/[id]/hedera/confirm
 * Verifies Hedera transaction then marks only the payouts included in the tx (includedPayoutIds) as PAID.
 * includedPayoutIds is required so we never mark payouts that were not actually paid on-chain.
 * 
 * NOTE: This API is restricted to beta admins during BETA_LOCKDOWN_MODE
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { isBetaAdminEmail } from '@/lib/auth/admin-shared';
import { applyRateLimit } from '@/lib/rate-limit';
import { CURRENT_NETWORK } from '@/lib/hedera/constants';
import { log } from '@/lib/logger';
import { z } from 'zod';

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
  organizationId: z.string().uuid(),
  includedPayoutIds: z.array(z.string().uuid()).min(1, 'includedPayoutIds is required and must have at least one payout id'),
});

const MIRROR_URL =
  CURRENT_NETWORK === 'mainnet'
    ? 'https://mainnet-public.mirrornode.hedera.com'
    : 'https://testnet.mirrornode.hedera.com';

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

    const { id: batchId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = ConfirmSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      const msg = issues.map((e: { message: string }) => e.message).join('; ') || 'transactionId, organizationId, and includedPayoutIds required';
      return NextResponse.json(
        { error: msg, details: issues },
        { status: 400 }
      );
    }

    const { transactionId, organizationId, includedPayoutIds } = parsed.data;

    const canManage = await checkUserPermission(user.id, organizationId, 'manage_ledger');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const batch = await prisma.payout_batches.findFirst({
      where: { id: batchId, organization_id: organizationId },
      include: {
        payouts: {
          where: { status: { not: 'PAID' } },
          select: { id: true },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const unpaidIds = new Set(batch.payouts.map((p) => p.id));
    if (unpaidIds.size === 0) {
      return NextResponse.json(
        { error: 'No unpaid payouts in this batch; nothing to confirm' },
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

    const normalizedTxId = transactionId.replace('@', '-');
    const txUrl = `${MIRROR_URL}/api/v1/transactions/${normalizedTxId}`;
    const res = await fetch(txUrl, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Transaction not found or not yet indexed on Hedera', status: res.status },
        { status: 404 }
      );
    }
    const data = (await res.json()) as { transactions?: Array<{ result: string }> };
    const mirrorTx = data.transactions?.[0];
    if (!mirrorTx || mirrorTx.result !== 'SUCCESS') {
      return NextResponse.json(
        {
          error: mirrorTx
            ? `Transaction failed with result: ${mirrorTx.result}`
            : 'Transaction not found',
        },
        { status: 400 }
      );
    }

    const paidAt = new Date();
    const externalRef = `hedera:${normalizedTxId}`;
    // Only mark payouts that were actually included in the on-chain tx (deterministic linkage).
    await prisma.$transaction(async (tx) => {
      await tx.payouts.updateMany({
        where: { id: { in: includedPayoutIds } },
        data: { status: 'PAID', external_reference: externalRef, paid_at: paidAt },
      });
      await tx.commission_obligation_lines.updateMany({
        where: { payout_id: { in: includedPayoutIds } },
        data: { status: 'PAID', paid_at: paidAt },
      });
      const txAny = tx as Record<string, { updateMany?: (args: unknown) => Promise<unknown> } | undefined>;
      if (txAny.commission_obligation_items?.updateMany) {
        await txAny.commission_obligation_items.updateMany({
          where: { payout_id: { in: includedPayoutIds } },
          data: { status: 'PAID', paid_at: paidAt },
        });
      }
    });

    log.info('Payout batch confirmed and marked PAID (Hedera)', {
      batchId,
      organizationId,
      transactionId: normalizedTxId,
      payoutCount: includedPayoutIds.length,
    });

    return NextResponse.json({
      data: { batchId, transactionId: normalizedTxId, payoutIds: includedPayoutIds, status: 'PAID' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
