/**
 * POST /api/public/pay/[shortCode]/evm/pending
 * Register a broadcast MetaMask transaction and start confirmation.
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  isEvmWalletRailGloballyEnabled,
  registerEvmWalletPendingPayment,
  resolveMerchantEvmWallet,
} from '@/lib/payments/evm-wallet-rail.server';
import { paymentLinkAllowsMultiCheckoutRail } from '@/lib/payments/payment-link-rail-access';
import { normalizeNetworkId } from '@/lib/evm/networks';
import type { EvmSettlementToken } from '@/lib/evm/tokens';
import { log } from '@/lib/logger';
import { applyRateLimit } from '@/lib/rate-limit';
import { isValidShortCode } from '@/lib/short-code';
import { prisma } from '@/lib/server/prisma';

const PendingSchema = z.object({
  transactionHash: z.string().min(1),
  network: z.string().min(1),
  walletAddress: z.string().min(1),
  token: z.enum(['USDC', 'USDT']),
  tokenAmount: z.union([z.string(), z.number()]),
  exchangeRate: z.number().positive().optional(),
  chainId: z.number().int().positive().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, 'api');
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { shortCode } = await params;
  if (!isValidShortCode(shortCode)) {
    return NextResponse.json({ error: 'Invalid short code' }, { status: 400 });
  }

  if (!isEvmWalletRailGloballyEnabled()) {
    return NextResponse.json({ error: 'MetaMask payments are not enabled' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = PendingSchema.parse(body);

    const networkId = normalizeNetworkId(parsed.network);
    if (!networkId) {
      return NextResponse.json({ error: 'Unsupported network' }, { status: 400 });
    }

    const paymentLink = await prisma.payment_links.findUnique({
      where: { short_code: shortCode },
      select: {
        id: true,
        status: true,
        payment_method: true,
        organization_id: true,
      },
    });

    if (!paymentLink) {
      return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
    }

    if (paymentLink.status !== 'OPEN') {
      return NextResponse.json({ error: 'Payment link is not open for payment' }, { status: 400 });
    }

    if (!paymentLinkAllowsMultiCheckoutRail(paymentLink.payment_method, 'EVM_WALLET')) {
      return NextResponse.json({ error: 'This invoice does not accept MetaMask payments' }, { status: 400 });
    }

    const merchantSettings = await prisma.merchant_settings.findFirst({
      where: { organization_id: paymentLink.organization_id },
      select: { evm_wallet_address: true },
    });
    const merchantWallet = resolveMerchantEvmWallet(merchantSettings);
    if (!merchantWallet) {
      return NextResponse.json(
        { error: 'Merchant MetaMask receive address is not configured' },
        { status: 400 }
      );
    }

    const { transactionHash } = await registerEvmWalletPendingPayment({
      paymentLinkId: paymentLink.id,
      organizationId: paymentLink.organization_id,
      transactionHash: parsed.transactionHash,
      networkId,
      walletAddress: parsed.walletAddress,
      token: parsed.token as EvmSettlementToken,
      tokenAmount: String(parsed.tokenAmount),
      exchangeRate: parsed.exchangeRate ?? null,
      merchantWalletAddress: merchantWallet,
      chainId: parsed.chainId ?? null,
    });

    log.info('EVM pending payment registered', {
      paymentLinkId: paymentLink.id,
      transactionHash,
      networkId,
    });

    return NextResponse.json({
      success: true,
      data: {
        paymentLinkId: paymentLink.id,
        transactionHash,
        status: 'confirming',
        message: 'Waiting for confirmation...',
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('Failed to register EVM pending payment', message, { shortCode });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
