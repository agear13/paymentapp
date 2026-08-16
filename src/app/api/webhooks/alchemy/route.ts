/**
 * Alchemy Notify Webhook
 * POST /api/webhooks/alchemy
 *
 * Receives Alchemy ADDRESS_ACTIVITY events, matches pending MetaMask payments,
 * and forwards normalized payloads to the EVM settlement webhook.
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { log } from '@/lib/logger';
import { config } from '@/lib/config/env';
import {
  parseAlchemyAddressActivity,
  verifyAlchemyWebhookSignature,
} from '@/lib/evm/alchemy.server';
import { parseAlchemyOutboundAddressActivity } from '@/lib/evm/alchemy-outbound.server';
import {
  buildPendingContextFromMetadata,
  pollAndConfirmEvmPayment,
} from '@/lib/evm/evm-confirmation.server';
import { findPendingEvmPaymentByTxHash } from '@/lib/payments/evm-wallet-rail.server';
import { resolveMerchantEvmWallet } from '@/lib/payments/evm-wallet-rail.server';
import { prisma } from '@/lib/server/prisma';
import { ingestObservedTransferForOrganization } from '@/lib/treasury/observers/wallet-transfer/observe-wallet-transfers';

async function observeOutboundFromAlchemyWebhook(
  payload: Record<string, unknown>
): Promise<void> {
  const event = payload.event as Record<string, unknown> | undefined;
  const activities =
    (event?.activity as Array<{ fromAddress?: string }> | undefined) ?? [];

  const fromAddresses = [
    ...new Set(
      activities
        .map((a) => a.fromAddress?.trim())
        .filter((address): address is string => Boolean(address))
    ),
  ];

  for (const fromAddress of fromAddresses) {
    const merchantSettings = await prisma.merchant_settings.findFirst({
      where: {
        evm_wallet_enabled: true,
        evm_wallet_address: { equals: fromAddress, mode: 'insensitive' },
      },
      select: { organization_id: true, evm_wallet_address: true },
    });

    if (!merchantSettings?.evm_wallet_address) continue;

    const outbound = parseAlchemyOutboundAddressActivity(
      payload as Parameters<typeof parseAlchemyOutboundAddressActivity>[0],
      merchantSettings.evm_wallet_address
    );
    if (!outbound) continue;

    await ingestObservedTransferForOrganization(
      merchantSettings.organization_id,
      outbound
    );
  }
}

async function forwardToEvmWalletWebhook(payload: Record<string, unknown>): Promise<Response> {
  const baseUrl = config.appUrl.replace(/\/$/, '');
  const secret = process.env.EVM_WALLET_WEBHOOK_SECRET;
  const body = JSON.stringify({
    event_type: 'payment.confirmed',
    status: 'confirmed',
    data: payload,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (secret) {
    const signature = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
    headers['x-signature-sha256'] = signature;
  }

  return fetch(`${baseUrl}/api/webhooks/evm-wallet`, {
    method: 'POST',
    headers,
    body,
  });
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const correlationId = `alchemy_webhook_${startedAt}`;

  try {
    const body = await request.text();
    const signature =
      request.headers.get('x-alchemy-signature') ??
      request.headers.get('X-Alchemy-Signature');

    if (!verifyAlchemyWebhookSignature(body, signature)) {
      log.warn('Alchemy webhook signature invalid', { correlationId });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const event = payload.event as Record<string, unknown> | undefined;
    const activities = (event?.activity as Array<{ hash?: string }>) ?? [];
    const txHashes = activities.map((a) => a.hash).filter(Boolean) as string[];

    if (txHashes.length === 0) {
      return NextResponse.json({ received: true, processed: false, reason: 'no_transactions' });
    }

    void observeOutboundFromAlchemyWebhook(payload).catch((error: unknown) => {
      log.warn('Alchemy outbound treasury observation failed', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    for (const txHash of txHashes) {
      const pending = await findPendingEvmPaymentByTxHash(txHash);
      if (!pending) continue;

      const paymentLink = await prisma.payment_links.findUnique({
        where: { id: pending.paymentLinkId },
        select: { organization_id: true },
      });
      if (!paymentLink) continue;

      const merchantSettings = await prisma.merchant_settings.findFirst({
        where: { organization_id: paymentLink.organization_id },
        select: { evm_wallet_address: true },
      });
      const merchantWallet = resolveMerchantEvmWallet(merchantSettings);
      if (!merchantWallet) continue;

      const transfer = parseAlchemyAddressActivity(
        payload as Parameters<typeof parseAlchemyAddressActivity>[0],
        merchantWallet
      );
      if (!transfer) continue;

      const context = buildPendingContextFromMetadata(
        pending.paymentLinkId,
        pending.metadata,
        merchantWallet
      );

      const forwardPayload = {
        paymentLinkId: pending.paymentLinkId,
        transactionHash: transfer.transactionHash,
        network: transfer.networkId,
        walletAddress: context?.walletAddress ?? transfer.fromAddress,
        token: transfer.token,
        tokenAmount: transfer.tokenAmount,
        exchangeRate: context?.exchangeRate ?? undefined,
        walletProvider: 'metamask',
        chainId: context?.chainId ?? undefined,
        tokenContractAddress: transfer.tokenContractAddress,
        merchantWalletAddress: merchantWallet,
        blockNumber: transfer.blockNumber,
      };

      const response = await forwardToEvmWalletWebhook(forwardPayload);
      const result = await response.json().catch(() => ({}));

      log.info('Alchemy webhook forwarded to EVM settlement', {
        correlationId,
        paymentLinkId: pending.paymentLinkId,
        transactionHash: txHash,
        forwardStatus: response.status,
        durationMs: Date.now() - startedAt,
      });

      return NextResponse.json({
        received: true,
        processed: response.ok,
        paymentLinkId: pending.paymentLinkId,
        result,
      });
    }

    return NextResponse.json({ received: true, processed: false, reason: 'no_matching_pending' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('Alchemy webhook failed', message, { correlationId });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
