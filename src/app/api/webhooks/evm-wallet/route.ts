/**
 * EVM Wallet Webhook Endpoint
 * POST /api/webhooks/evm-wallet - Handle confirmed on-chain wallet payments.
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { log } from '@/lib/logger';
import { confirmEvmWalletPayment } from '@/lib/payments/evm-wallet';

type EvmWalletWebhookPayload = {
  delivery_id?: string;
  event_id?: string;
  event_type?: string;
  status?: string;
  data?: Record<string, unknown>;
} & Record<string, unknown>;

function verifyEvmWalletWebhookSignature(body: string, signature: string | null): boolean {
  const secret = process.env.EVM_WALLET_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signature) return false;

  const normalized = signature.trim().toLowerCase();
  const signatureValue = normalized.includes('=') ? normalized.split('=').pop() ?? '' : normalized;
  if (!signatureValue) return false;

  const expected = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  const provided = Buffer.from(signatureValue, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (provided.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(provided, expectedBuffer);
}

function stringField(source: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function numberField(source: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const requestCorrelationId = `evm_wallet_webhook_${startedAt}`;

  try {
    const body = await request.text();
    const signature =
      request.headers.get('x-signature-sha256') ??
      request.headers.get('X-Signature-SHA256') ??
      request.headers.get('x-evm-signature');

    if (!verifyEvmWalletWebhookSignature(body, signature)) {
      log.warn({ correlationId: requestCorrelationId }, 'EVM wallet webhook signature missing or invalid');
      return NextResponse.json({ error: 'Invalid or missing signature' }, { status: 401 });
    }

    let payload: EvmWalletWebhookPayload;
    try {
      payload = JSON.parse(body) as EvmWalletWebhookPayload;
    } catch {
      log.warn({ correlationId: requestCorrelationId }, 'EVM wallet webhook invalid JSON');
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const status = String(payload.status ?? '').toLowerCase();
    const eventType = String(payload.event_type ?? '').toLowerCase();
    if (
      (eventType && !['payment.confirmed', 'evm.payment.confirmed', 'transaction.confirmed'].includes(eventType)) ||
      (status && !['confirmed', 'succeeded', 'success', 'paid'].includes(status))
    ) {
      log.info(
        { correlationId: requestCorrelationId, eventType: payload.event_type, status: payload.status },
        'EVM wallet webhook skipped - not a confirmed payment'
      );
      return NextResponse.json({ received: true, processed: false });
    }

    const data =
      payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
        ? payload.data
        : payload;

    const paymentLinkId = stringField(data, 'payment_link_id', 'paymentLinkId');
    const transactionHash = stringField(data, 'transaction_hash', 'transactionHash', 'tx_hash', 'txHash');
    const network = stringField(data, 'network', 'chain', 'chain_name', 'chainName');
    const walletAddress = stringField(
      data,
      'wallet_address',
      'walletAddress',
      'payer_wallet_address',
      'payerWalletAddress'
    );
    const token = stringField(data, 'token', 'token_symbol', 'tokenSymbol', 'currency');
    const tokenAmount = stringField(data, 'token_amount', 'tokenAmount', 'amount', 'amount_received');

    if (!paymentLinkId || !transactionHash || !network || !walletAddress || !token || !tokenAmount) {
      return NextResponse.json(
        {
          error:
            'Missing required EVM payment fields: paymentLinkId, transactionHash, network, walletAddress, token, tokenAmount',
        },
        { status: 400 }
      );
    }

    const result = await confirmEvmWalletPayment({
      paymentLinkId,
      transactionHash,
      network,
      walletAddress,
      token,
      tokenAmount,
      walletProvider: stringField(data, 'wallet_provider', 'walletProvider') ?? 'metamask',
      chainId: stringField(data, 'chain_id', 'chainId'),
      tokenContractAddress: stringField(data, 'token_contract_address', 'tokenContractAddress'),
      merchantWalletAddress: stringField(data, 'merchant_wallet_address', 'merchantWalletAddress'),
      blockNumber: stringField(data, 'block_number', 'blockNumber'),
      confirmedAt: stringField(data, 'confirmed_at', 'confirmedAt'),
      exchangeRate: numberField(data, 'exchange_rate', 'exchangeRate', 'fx_rate', 'fxRate'),
      correlationId:
        stringField(payload, 'delivery_id', 'event_id') ??
        stringField(data, 'delivery_id', 'event_id') ??
        requestCorrelationId,
      metadata: {
        provider_event_id: payload.event_id ?? payload.delivery_id ?? null,
        event_type: payload.event_type ?? null,
        raw_status: payload.status ?? null,
      },
    });

    if (!result.success) {
      log.error(
        { correlationId: requestCorrelationId, paymentLinkId, transactionHash, error: result.error },
        'EVM wallet confirmPayment failed'
      );
      return NextResponse.json({ error: result.error ?? 'Confirmation failed' }, { status: 500 });
    }

    log.info(
      {
        correlationId: requestCorrelationId,
        paymentLinkId,
        transactionHash,
        paymentEventId: result.paymentEventId,
        alreadyProcessed: result.alreadyProcessed,
        durationMs: Date.now() - startedAt,
      },
      'EVM wallet payment confirmed'
    );

    return NextResponse.json({ received: true, processed: true, paymentEventId: result.paymentEventId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error({ correlationId: requestCorrelationId, error: message }, 'EVM wallet webhook failed');
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
