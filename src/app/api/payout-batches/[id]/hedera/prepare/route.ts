/**
 * POST /api/payout-batches/[id]/hedera/prepare
 * Builds a Hedera HTS transfer (USDC MVP) from merchant to all payees; returns frozen tx as base64 for HashPack signing.
 */

import Long from 'long';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { getPayoutTokenForCurrency } from '@/lib/hedera/tokens';
import { CURRENT_NODE_ACCOUNT_ID } from '@/lib/hedera/constants';
import { toSmallestUnit, fromSmallestUnit } from '@/lib/hedera/amount-utils';
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
          include: { payout_methods: true },
        },
        organizations: {
          include: { merchant_settings: { select: { hedera_account_id: true } } },
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
    const payees: {
      payoutId: string;
      userId: string;
      hederaAccountId: string;
      netAmountStr: string;
    }[] = [];
    for (const p of unpaid) {
      const method = p.payout_methods;
      const isHedera = String(method?.method_type) === 'HEDERA';
      const hederaId = isHedera ? (method as { hedera_account_id?: string | null })?.hedera_account_id?.trim() : undefined;
      if (!hederaId) {
        missing.push(p.user_id);
        continue;
      }
      payees.push({
        payoutId: p.id,
        userId: p.user_id,
        hederaAccountId: hederaId,
        netAmountStr: p.net_amount.toString(),
      });
    }

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: 'Some payees do not have a Hedera payout destination (method_type must be HEDERA)',
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

    const includedPayees: typeof payees = [];
    const includedPayoutIds: string[] = [];
    let totalSmallest = BigInt(0);

    for (const payee of payees) {
      let small: bigint;
      try {
        small = toSmallestUnit(payee.netAmountStr, decimals);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Invalid amount';
        return NextResponse.json(
          { error: `Invalid payout amount for payee: ${msg}` },
          { status: 400 }
        );
      }
      if (small === BigInt(0)) {
        continue;
      }
      totalSmallest += small;
      includedPayees.push(payee);
      includedPayoutIds.push(payee.payoutId);
      // Hedera SDK expects int64; Long avoids bigint/Number overflow for token units.
      transferTx.addTokenTransfer(
        tokenInfo.tokenId!,
        AccountId.fromString(payee.hederaAccountId),
        Long.fromString(small.toString())
      );
    }

    if (includedPayees.length === 0 || totalSmallest === BigInt(0)) {
      return NextResponse.json(
        { error: 'Nothing to pay (all payee amounts are zero)' },
        { status: 400 }
      );
    }

    transferTx.addTokenTransfer(
      tokenInfo.tokenId!,
      AccountId.fromString(merchantAccountId),
      Long.fromString(totalSmallest.toString()).negate()
    );
    transferTx.setTransactionMemo(`Provvypay payout batch ${batchId}`);

    const txId = TransactionId.generate(AccountId.fromString(merchantAccountId));
    transferTx.setTransactionId(txId);

    const frozen = transferTx.freeze();
    const bytes = frozen.toBytes();
    const transactionBase64 = Buffer.from(bytes).toString('base64');

    const summary = includedPayees.map((p) => ({
      userId: p.userId,
      hederaAccountId: p.hederaAccountId,
      amount: p.netAmountStr,
      symbol: tokenInfo.symbol,
    }));

    return NextResponse.json({
      data: {
        transactionBase64,
        merchantAccountId,
        summary,
        includedPayoutIds,
        totalAmount: fromSmallestUnit(totalSmallest, decimals),
        totalSmallestUnit: totalSmallest.toString(),
        decimals,
        tokenSymbol: tokenInfo.symbol,
        tokenId: tokenInfo.tokenId,
        batchId,
        payeeCount: includedPayees.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
