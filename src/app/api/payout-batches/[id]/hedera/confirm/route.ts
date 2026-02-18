/**
 * POST /api/payout-batches/[id]/hedera/confirm
 * Verifies Hedera transaction then marks all batch payouts (and their lines/items) as PAID.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { CURRENT_NETWORK } from '@/lib/hedera/constants';
import { log } from '@/lib/logger';
import { z } from 'zod';

const ConfirmSchema = z.object({
  transactionId: z.string().regex(/^0\.0\.\d+[@-]\d+\.\d+$/),
  organizationId: z.string().uuid(),
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

    const { id: batchId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = ConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'transactionId and organizationId required', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { transactionId, organizationId } = parsed.data;

    const canManage = await checkUserPermission(user.id, organizationId, 'manage_ledger');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const batch = await prisma.payout_batches.findFirst({
      where: { id: batchId, organization_id: organizationId },
      include: { payouts: { where: { status: { not: 'PAID' } }, select: { id: true } } },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
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
    const payoutIds = batch.payouts.map((p) => p.id);

    await prisma.$transaction(async (tx) => {
      await tx.payouts.updateMany({
        where: { id: { in: payoutIds } },
        data: { status: 'PAID', external_reference: externalRef, paid_at: paidAt },
      });
      await tx.commission_obligation_lines.updateMany({
        where: { payout_id: { in: payoutIds } },
        data: { status: 'PAID', paid_at: paidAt },
      });
      await tx.commission_obligation_items.updateMany({
        where: { payout_id: { in: payoutIds } },
        data: { status: 'PAID', paid_at: paidAt },
      });
    });

    log.info(
      { batchId, organizationId, transactionId: normalizedTxId, payoutCount: payoutIds.length },
      'Payout batch confirmed and marked PAID (Hedera)'
    );

    return NextResponse.json({
      data: { batchId, transactionId: normalizedTxId, payoutIds, status: 'PAID' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
