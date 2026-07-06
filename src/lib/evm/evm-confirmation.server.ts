import 'server-only';

import { log } from '@/lib/logger';
import { prisma } from '@/lib/server/prisma';
import { confirmEvmWalletPayment } from '@/lib/payments/evm-wallet';
import {
  parseErc20TransferFromReceipt,
  waitForTransactionReceipt,
  type ParsedErc20Transfer,
} from '@/lib/evm/alchemy.server';
import { normalizeNetworkId, type EvmNetworkId } from '@/lib/evm/networks';
import type { Hash } from 'viem';

export type EvmPendingPaymentContext = {
  paymentLinkId: string;
  transactionHash: string;
  networkId: EvmNetworkId;
  walletAddress: string;
  token: string;
  tokenAmount: string;
  exchangeRate?: number | null;
  merchantWalletAddress: string;
  tokenContractAddress?: string | null;
  chainId?: number | null;
};

export async function confirmEvmPaymentFromTransfer(
  transfer: ParsedErc20Transfer,
  context: {
    paymentLinkId: string;
    exchangeRate?: number | null;
    walletProvider?: string;
    correlationId?: string;
  }
) {
  return confirmEvmWalletPayment({
    paymentLinkId: context.paymentLinkId,
    transactionHash: transfer.transactionHash,
    network: transfer.networkId,
    walletAddress: transfer.fromAddress,
    token: transfer.token,
    tokenAmount: transfer.tokenAmount,
    walletProvider: context.walletProvider ?? 'metamask',
    chainId: EVM_NETWORKS_CHAIN_ID[transfer.networkId],
    tokenContractAddress: transfer.tokenContractAddress,
    merchantWalletAddress: transfer.toAddress,
    blockNumber: transfer.blockNumber,
    exchangeRate: context.exchangeRate ?? undefined,
    correlationId: context.correlationId,
    metadata: {
      confirmation_source: 'alchemy',
    },
  });
}

const EVM_NETWORKS_CHAIN_ID: Record<EvmNetworkId, number> = {
  ethereum: 1,
  base: 8453,
  polygon: 137,
};

export async function pollAndConfirmEvmPayment(context: EvmPendingPaymentContext): Promise<void> {
  const correlationId = `evm_poll_${context.transactionHash.slice(0, 10)}`;

  try {
    log.info('Starting EVM transaction confirmation poll', {
      correlationId,
      paymentLinkId: context.paymentLinkId,
      transactionHash: context.transactionHash,
    });

    const receipt = await waitForTransactionReceipt(
      context.networkId,
      context.transactionHash as Hash
    );

    if (receipt.status !== 'success') {
      await prisma.payment_events.create({
        data: {
          payment_link_id: context.paymentLinkId,
          event_type: 'PAYMENT_FAILED',
          payment_method: 'EVM_WALLET',
          metadata: {
            transaction_hash: context.transactionHash,
            network: context.networkId,
            reason: 'transaction_reverted',
          },
        },
      });
      return;
    }

    const transfer = parseErc20TransferFromReceipt(
      receipt,
      context.networkId,
      context.merchantWalletAddress
    );

    if (!transfer) {
      log.warn('EVM receipt found but no valid ERC-20 transfer to merchant', {
        correlationId,
        paymentLinkId: context.paymentLinkId,
      });
      return;
    }

    const result = await confirmEvmWalletPayment({
      paymentLinkId: context.paymentLinkId,
      transactionHash: transfer.transactionHash,
      network: transfer.networkId,
      walletAddress: context.walletAddress,
      token: transfer.token,
      tokenAmount: transfer.tokenAmount,
      walletProvider: 'metamask',
      chainId: context.chainId ?? EVM_NETWORKS_CHAIN_ID[transfer.networkId],
      tokenContractAddress: transfer.tokenContractAddress,
      merchantWalletAddress: context.merchantWalletAddress,
      blockNumber: transfer.blockNumber,
      exchangeRate: context.exchangeRate ?? undefined,
      correlationId,
      metadata: {
        confirmation_source: 'rpc_poll',
        expected_token: context.token,
        expected_token_amount: context.tokenAmount,
      },
    });

    log.info('EVM poll confirmation finished', {
      correlationId,
      paymentLinkId: context.paymentLinkId,
      success: result.success,
      alreadyProcessed: result.alreadyProcessed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('EVM confirmation poll failed', message, {
      correlationId,
      paymentLinkId: context.paymentLinkId,
    });
  }
}

export function buildPendingContextFromMetadata(
  paymentLinkId: string,
  metadata: Record<string, unknown>,
  merchantWalletAddress: string
): EvmPendingPaymentContext | null {
  const transactionHash = String(metadata.transaction_hash ?? metadata.transactionHash ?? '');
  const networkRaw = String(metadata.network ?? '');
  const networkId = normalizeNetworkId(networkRaw);
  const walletAddress = String(metadata.wallet_address ?? metadata.walletAddress ?? '');
  const token = String(metadata.token ?? '');
  const tokenAmount = String(metadata.token_amount ?? metadata.tokenAmount ?? '');

  if (!transactionHash || !networkId || !walletAddress || !token || !tokenAmount) {
    return null;
  }

  return {
    paymentLinkId,
    transactionHash,
    networkId,
    walletAddress,
    token,
    tokenAmount,
    exchangeRate:
      typeof metadata.exchange_rate === 'number'
        ? metadata.exchange_rate
        : typeof metadata.exchangeRate === 'number'
          ? metadata.exchangeRate
          : null,
    merchantWalletAddress,
    tokenContractAddress: String(metadata.token_contract_address ?? '') || null,
    chainId:
      typeof metadata.chain_id === 'number'
        ? metadata.chain_id
        : typeof metadata.chainId === 'number'
          ? metadata.chainId
          : null,
  };
}
