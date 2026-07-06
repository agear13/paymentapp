import 'server-only';

import type { TokenType } from '@/lib/hedera/constants';
import { generateCorrelationId } from '@/lib/services/correlation';
import {
  confirmPayment,
  type ConfirmPaymentResult,
} from '@/lib/services/payment-confirmation';

const SUPPORTED_EVM_SETTLEMENT_TOKENS = ['HBAR', 'USDC', 'USDT', 'AUDD'] as const;

export type EvmSettlementToken = (typeof SUPPORTED_EVM_SETTLEMENT_TOKENS)[number];

export interface ConfirmEvmWalletPaymentParams {
  paymentLinkId: string;
  transactionHash: string;
  network: string;
  walletAddress: string;
  token: string;
  tokenAmount: string | number;
  walletProvider?: string | null;
  chainId?: string | number | null;
  tokenContractAddress?: string | null;
  merchantWalletAddress?: string | null;
  blockNumber?: string | number | null;
  confirmedAt?: string | Date | null;
  exchangeRate?: number | null;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export function normalizeEvmTransactionHash(transactionHash: string): string {
  const normalized = transactionHash.trim().toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(normalized)) {
    throw new Error('Invalid EVM transaction hash');
  }
  return normalized;
}

export function normalizeEvmWalletAddress(walletAddress: string): string {
  const normalized = walletAddress.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    throw new Error('Invalid EVM wallet address');
  }
  return normalized;
}

export function normalizeEvmSettlementToken(token: string): EvmSettlementToken {
  const normalized = token.trim().toUpperCase();
  if (!SUPPORTED_EVM_SETTLEMENT_TOKENS.includes(normalized as EvmSettlementToken)) {
    throw new Error(
      `Unsupported EVM settlement token: ${token}. Supported tokens: ${SUPPORTED_EVM_SETTLEMENT_TOKENS.join(', ')}`
    );
  }
  return normalized as EvmSettlementToken;
}

export function evmProviderReference(params: {
  network: string;
  transactionHash: string;
}): string {
  const network = params.network.trim().toLowerCase();
  if (!network) {
    throw new Error('EVM network is required');
  }
  return `${network}:${normalizeEvmTransactionHash(params.transactionHash)}`;
}

/**
 * Automated EVM wallet settlement adapter.
 *
 * Wallet brands (MetaMask, Rabby, Coinbase Wallet, etc.) remain metadata; the
 * business rail is EVM_WALLET and always converges through confirmPayment().
 */
export async function confirmEvmWalletPayment(
  params: ConfirmEvmWalletPaymentParams
): Promise<ConfirmPaymentResult> {
  const token = normalizeEvmSettlementToken(params.token);
  const transactionHash = normalizeEvmTransactionHash(params.transactionHash);
  const walletAddress = normalizeEvmWalletAddress(params.walletAddress);
  const merchantWalletAddress = params.merchantWalletAddress
    ? normalizeEvmWalletAddress(params.merchantWalletAddress)
    : undefined;
  const network = params.network.trim().toLowerCase();
  if (!network) {
    throw new Error('EVM network is required');
  }

  const amountReceived = Number(params.tokenAmount);
  if (!Number.isFinite(amountReceived) || amountReceived <= 0) {
    throw new Error('EVM token amount must be a positive number');
  }

  const providerRef = evmProviderReference({ network, transactionHash });
  const correlationId =
    params.correlationId ?? generateCorrelationId('evm_wallet', providerRef);

  return confirmPayment({
    paymentLinkId: params.paymentLinkId,
    provider: 'evm_wallet',
    providerRef,
    transactionId: transactionHash,
    amountReceived,
    currencyReceived: token,
    tokenType: token as TokenType,
    fxRate: params.exchangeRate ?? undefined,
    correlationId,
    metadata: {
      ...params.metadata,
      wallet_provider: params.walletProvider?.trim() || 'evm_wallet',
      wallet_address: walletAddress,
      payer_wallet_address: walletAddress,
      merchant_wallet_address: merchantWalletAddress ?? null,
      network,
      chain_id: params.chainId ?? null,
      transaction_hash: transactionHash,
      token,
      token_type: token,
      token_contract_address: params.tokenContractAddress?.trim() || null,
      block_number: params.blockNumber ?? null,
      exchange_rate: params.exchangeRate ?? null,
      confirmed_at:
        params.confirmedAt instanceof Date
          ? params.confirmedAt.toISOString()
          : params.confirmedAt ?? null,
    },
  });
}
