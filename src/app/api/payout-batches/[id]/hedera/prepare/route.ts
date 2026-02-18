/**
 * POST /api/payout-batches/[id]/hedera/prepare
 * Builds a Hedera HTS transfer (USDC MVP) from merchant to all payees; returns frozen tx as base64 for HashPack signing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { getPayoutTokenForCurrency } from '@/lib/hedera/tokens';
import { CURRENT_NODE_ACCOUNT_ID } from '@/lib/hedera/constants';
import { toSmallestUnit } from '@/lib/hedera/amount-utils';
import { TransferTransaction, AccountId, TransactionId } from '@hashgraph/sdk';

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
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const canManage = await checkUserPermission(user.id, organizationId, 'manage_ledger');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const batch = await prisma.payout_batches.findFirst({
      where: { id: batchId, organization_id: organizationId },
      include: {
        payouts: {
          where: { status: { not: 'PAID' } },
          include: {
            payout_methods: { select: { hedera_account_id: true, method_type: true } },
          },
        },
        organizations: {
          include: {
            merchant_settings: { select: { hedera_account_id: true } },
          },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const merchantAccountId = batch.organizations?.merchant_settings?.[0]?.hedera_account_id;
    if (!merchantAccountId?.trim()) {
      return NextResponse.json(
        { error: 'Merchant Hedera account not configured. Set hedera_account_id in merchant settings.' },
        { status: 400 }
      );
    }

    const tokenInfo = getPayoutTokenForCurrency(batch.currency);
    if (!tokenInfo || !tokenInfo.tokenId) {
      return NextResponse.json(
        { error: `Batch currency ${batch.currency} is not supported for on-chain payout. MVP: USD/USDC only.` },
        { status: 400 }
      );
    }

    const unpaid = batch.payouts;
    const missing: string[] = [];
    const payees: { userId: string; hederaAccountId: string; netAmount: number }[] = [];
    for (const p of unpaid) {
      const hederaId = p.payout_methods?.hedera_account_id?.trim();
      if (!hederaId) {
        missing.push(p.user_id);
        continue;
      }
      payees.push({
        userId: p.user_id,
        hederaAccountId: hederaId,
        netAmount: Number(p.net_amount),
      });
    }

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: 'Some payees do not have a Hedera payout destination',
          missingPayeeUserIds: missing,
        },
        { status: 400 }
      );
    }

    if (payees.length === 0) {
      return NextResponse.json(
        { error: 'No unpaid payouts in this batch or all payouts already paid' },
        { status: 400 }
      );
    }

    const decimals = tokenInfo.decimals;
    const transferTx = new TransferTransaction()
      .setNodeAccountIds([AccountId.fromString(CURRENT_NODE_ACCOUNT_ID)]);

    let totalSmallest = 0n;
    for (const payee of payees) {
      const small = toSmallestUnit(payee.netAmount, decimals);
      const n = Number(small);
      if (!Number.isSafeInteger(n)) {
        return NextResponse.json({ error: 'Payout amount exceeds safe integer range' }, { status: 400 });
      }
      transferTx.addTokenTransfer(tokenInfo.tokenId!, AccountId.fromString(payee.hederaAccountId), n);
      totalSmallest += small;
    }
    const totalNeg = Number(totalSmallest);
    if (!Number.isSafeInteger(-totalNeg)) {
      return NextResponse.json({ error: 'Total amount exceeds safe integer range' }, { status: 400 });
    }
    transferTx.addTokenTransfer(
      tokenInfo.tokenId!,
      AccountId.fromString(merchantAccountId),
      -totalNeg
    );
    transferTx.setTransactionMemo(`Provvypay payout batch ${batchId}`);

    const txId = TransactionId.generate(AccountId.fromString(merchantAccountId));
    transferTx.setTransactionId(txId);

    const frozen = transferTx.freeze();
    const bytes = frozen.toBytes();
    const transactionBase64 = Buffer.from(bytes).toString('base64');

    const summary = payees.map((p) => ({
      userId: p.userId,
      hederaAccountId: p.hederaAccountId,
      amount: p.netAmount,
      symbol: tokenInfo.symbol,
    }));
    const totalAmount = Number(totalSmallest) / Math.pow(10, decimals);

    return NextResponse.json({
      data: {
        transactionBase64,
        merchantAccountId,
        summary,
        totalAmount,
        tokenSymbol: tokenInfo.symbol,
        tokenId: tokenInfo.tokenId,
        batchId,
        payeeCount: payees.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
