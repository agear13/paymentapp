import 'server-only';

import config from '@/lib/config/env';
import { EVM_NETWORKS } from '@/lib/evm/networks';
import { EVM_SETTLEMENT_TOKENS, getTokenAddress, type EvmSettlementToken } from '@/lib/evm/tokens';
import { pollAndConfirmEvmPayment } from '@/lib/evm/evm-confirmation.server';
import type { EvmNetworkId } from '@/lib/evm/networks';
import {
  normalizeEvmTransactionHash,
  normalizeEvmWalletAddress,
} from '@/lib/payments/evm-wallet';
import { findPendingPaymentInitiatedByMetadataField } from '@/lib/payments/payment-initiated-lookup.server';
import { prisma } from '@/lib/server/prisma';

import { isEvmWalletAddressConfigured } from '@/lib/payments/evm-wallet-config';

export function isEvmWalletRailGloballyEnabled(): boolean {
  return config.features.evmWalletPayments;
}

/**
 * Resolve merchant EVM receive address from settings or env fallback.
 * Same pattern as Wise profile id / Hedera account id resolution.
 */
export function resolveMerchantEvmWallet(settings: {
  evm_wallet_address?: string | null;
} | null | undefined): string | null {
  const fromSettings = settings?.evm_wallet_address?.trim();
  if (fromSettings && isEvmWalletAddressConfigured(fromSettings)) {
    return fromSettings;
  }

  const fromEnv = process.env.EVM_MERCHANT_WALLET_ADDRESS?.trim();
  if (fromEnv && isEvmWalletAddressConfigured(fromEnv)) {
    return fromEnv;
  }

  return null;
}

export function buildEvmWalletCheckoutConfig(merchantWalletAddress: string) {
  const networks = Object.values(EVM_NETWORKS).map((network) => ({
    id: network.id,
    name: network.name,
    chainId: network.chain.id,
    tokens: EVM_SETTLEMENT_TOKENS.map((token) => ({
      symbol: token,
      contractAddress: getTokenAddress(token, network.id),
      decimals: 6,
    })),
  }));

  return {
    merchantWalletAddress,
    networks,
    defaultNetworkId: 'base' as const,
  };
}

export async function findPendingEvmPaymentByTxHash(transactionHash: string) {
  return findPendingPaymentInitiatedByMetadataField({
    paymentMethod: 'EVM_WALLET',
    metadataKeys: ['transaction_hash', 'transactionHash'],
    value: transactionHash,
  });
}

export type RegisterEvmWalletPendingPaymentInput = {
  paymentLinkId: string;
  organizationId: string;
  transactionHash: string;
  networkId: EvmNetworkId;
  walletAddress: string;
  token: EvmSettlementToken;
  tokenAmount: string;
  exchangeRate?: number | null;
  merchantWalletAddress: string;
  chainId?: number | null;
};

export async function registerEvmWalletPendingPayment(
  input: RegisterEvmWalletPendingPaymentInput
): Promise<{ transactionHash: string; alreadyRegistered: boolean }> {
  const transactionHash = normalizeEvmTransactionHash(input.transactionHash);
  const walletAddress = normalizeEvmWalletAddress(input.walletAddress);

  const existing = await findPendingEvmPaymentByTxHash(transactionHash);
  const alreadyRegistered =
    !!existing && existing.paymentLinkId === input.paymentLinkId;

  if (!alreadyRegistered) {
    await prisma.payment_events.create({
      data: {
        payment_link_id: input.paymentLinkId,
        organization_id: input.organizationId,
        event_type: 'PAYMENT_INITIATED',
        payment_method: 'EVM_WALLET',
        source_type: 'EVM_WALLET',
        metadata: {
          transaction_hash: transactionHash,
          transactionHash,
          transactionId: transactionHash,
          network: input.networkId,
          wallet_address: walletAddress,
          walletAddress,
          wallet_provider: 'metamask',
          token: input.token,
          token_amount: input.tokenAmount,
          tokenAmount: input.tokenAmount,
          exchange_rate: input.exchangeRate ?? null,
          exchangeRate: input.exchangeRate ?? null,
          merchant_wallet_address: input.merchantWalletAddress,
          token_contract_address: getTokenAddress(input.token, input.networkId),
          chain_id: input.chainId ?? null,
          status: 'confirming',
        },
      },
    });
  }

  void pollAndConfirmEvmPayment({
    paymentLinkId: input.paymentLinkId,
    transactionHash,
    networkId: input.networkId,
    walletAddress,
    token: input.token,
    tokenAmount: input.tokenAmount,
    exchangeRate: input.exchangeRate ?? null,
    merchantWalletAddress: input.merchantWalletAddress,
    tokenContractAddress: getTokenAddress(input.token, input.networkId),
    chainId: input.chainId ?? null,
  });

  return { transactionHash, alreadyRegistered };
}
