/**
 * GET /api/public/pay/[shortCode]/evm/config
 * Public MetaMask checkout configuration for a payment link.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  buildEvmWalletCheckoutConfig,
  isEvmWalletRailGloballyEnabled,
  resolveMerchantEvmWallet,
} from '@/lib/payments/evm-wallet-rail.server';
import { paymentLinkAllowsMultiCheckoutRail } from '@/lib/payments/payment-link-rail-access';
import { log } from '@/lib/logger';
import { isValidShortCode } from '@/lib/short-code';
import { prisma } from '@/lib/server/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  const { shortCode } = await params;

  if (!isValidShortCode(shortCode)) {
    return NextResponse.json({ error: 'Invalid short code' }, { status: 400 });
  }

  if (!isEvmWalletRailGloballyEnabled()) {
    return NextResponse.json({ error: 'MetaMask payments are not enabled' }, { status: 403 });
  }

  try {
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

    return NextResponse.json({
      data: {
        paymentLinkId: paymentLink.id,
        ...buildEvmWalletCheckoutConfig(merchantWallet),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('Failed to fetch EVM config', message, { shortCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
