import 'server-only';

import { getAlchemyApiKey, createEvmPublicClient } from '@/lib/evm/alchemy.server';
import { EVM_TOKENS, resolveTokenFromContractAddress, type EvmSettlementToken } from '@/lib/evm/tokens';
import { getAlchemyRpcUrl, type EvmNetworkId } from '@/lib/evm/networks';
import type { ObservedOutboundTransfer } from '@/lib/treasury/observers/wallet-transfer/types';

type AlchemyAssetTransfer = {
  hash?: string;
  from?: string;
  to?: string;
  asset?: string;
  category?: string;
  rawContract?: {
    address?: string;
    decimal?: string;
    value?: string;
  };
  metadata?: {
    blockTimestamp?: string;
  };
};

type AlchemyAssetTransferResponse = {
  result?: {
    transfers?: AlchemyAssetTransfer[];
  };
};

const SUPPORTED_OUTBOUND_TOKENS = new Set<EvmSettlementToken>(['USDC', 'USDT']);

export function buildEvmOutboundProviderReference(params: {
  networkId: EvmNetworkId;
  transactionHash: string;
  asset: string;
  sourceAddress: string;
  destinationAddress: string;
}): string {
  return `evm:outbound:${params.networkId}:${params.transactionHash.toLowerCase()}:${params.asset}:${params.sourceAddress.toLowerCase()}:${params.destinationAddress.toLowerCase()}`;
}

export async function fetchEvmOutboundErc20Transfers(params: {
  networkId: EvmNetworkId;
  merchantWalletAddress: string;
  maxCount?: number;
}): Promise<ObservedOutboundTransfer[]> {
  const apiKey = getAlchemyApiKey();
  if (!apiKey) return [];

  const merchant = params.merchantWalletAddress.toLowerCase();
  const url = getAlchemyRpcUrl(params.networkId, apiKey);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'alchemy_getAssetTransfers',
      params: [
        {
          fromBlock: '0x0',
          toBlock: 'latest',
          fromAddress: params.merchantWalletAddress,
          category: ['erc20'],
          withMetadata: true,
          excludeZeroValue: true,
          maxCount: `0x${(params.maxCount ?? 50).toString(16)}`,
          order: 'desc',
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Alchemy getAssetTransfers failed (${response.status})`);
  }

  const json = (await response.json()) as AlchemyAssetTransferResponse;
  const transfers = json.result?.transfers ?? [];
  const observed: ObservedOutboundTransfer[] = [];

  for (const transfer of transfers) {
    if (!transfer.hash || !transfer.from || !transfer.to) continue;
    if (transfer.from.toLowerCase() !== merchant) continue;

    const contractAddress = transfer.rawContract?.address;
    if (!contractAddress) continue;

    const token =
      resolveTokenFromContractAddress(contractAddress, params.networkId) ??
      (transfer.asset?.toUpperCase() === 'USDC' || transfer.asset?.toUpperCase() === 'USDT'
        ? (transfer.asset.toUpperCase() as EvmSettlementToken)
        : null);

    if (!token || !SUPPORTED_OUTBOUND_TOKENS.has(token)) continue;

    const decimals = EVM_TOKENS[token].decimals;
    const rawHex = transfer.rawContract?.value;
    if (!rawHex) continue;

    const rawValue = BigInt(rawHex);
    const amount = (Number(rawValue) / 10 ** decimals).toString();
    const destinationAddress = transfer.to;
    const sourceAddress = transfer.from;
    const transactionHash = transfer.hash.toLowerCase();

    const occurredAt = transfer.metadata?.blockTimestamp
      ? new Date(transfer.metadata.blockTimestamp)
      : new Date();

    observed.push({
      providerReference: buildEvmOutboundProviderReference({
        networkId: params.networkId,
        transactionHash,
        asset: token,
        sourceAddress,
        destinationAddress,
      }),
      transactionHash,
      asset: token,
      amount,
      sourceAddress,
      destinationAddress,
      walletNetwork: params.networkId,
      occurredAt,
      confirmationStatus: 'CONFIRMED',
      observationSource: 'alchemy_rpc',
      rawProviderPayload: transfer as unknown as Record<string, unknown>,
    });
  }

  return observed;
}

/** Parse outbound ERC-20 from Alchemy ADDRESS_ACTIVITY webhook payload. */
export function parseAlchemyOutboundAddressActivity(
  payload: {
    event?: {
      network?: string;
      activity?: Array<{
        hash?: string;
        fromAddress?: string;
        toAddress?: string;
        asset?: string;
        category?: string;
        rawContract?: { address?: string; rawValue?: string; decimals?: number };
      }>;
    };
  },
  merchantWalletAddress: string
): ObservedOutboundTransfer | null {
  const networkRaw = payload.event?.network ?? '';
  const networkId = alchemyNetworkToId(networkRaw);
  if (!networkId) return null;

  const merchant = merchantWalletAddress.toLowerCase();

  for (const activity of payload.event?.activity ?? []) {
    if (activity.category !== 'token') continue;
    if (!activity.hash || !activity.fromAddress || !activity.toAddress) continue;
    if (activity.fromAddress.toLowerCase() !== merchant) continue;

    const contractAddress = activity.rawContract?.address;
    if (!contractAddress) continue;

    const token =
      resolveTokenFromContractAddress(contractAddress, networkId) ??
      (activity.asset?.toUpperCase() === 'USDC' || activity.asset?.toUpperCase() === 'USDT'
        ? (activity.asset.toUpperCase() as EvmSettlementToken)
        : null);

    if (!token || !SUPPORTED_OUTBOUND_TOKENS.has(token)) continue;

    const decimals = activity.rawContract?.decimals ?? EVM_TOKENS[token].decimals;
    const rawValueHex = activity.rawContract?.rawValue;
    if (!rawValueHex) continue;

    const rawValue = BigInt(rawValueHex);
    const amount = (Number(rawValue) / 10 ** decimals).toString();
    const transactionHash = activity.hash.toLowerCase();

    return {
      providerReference: buildEvmOutboundProviderReference({
        networkId,
        transactionHash,
        asset: token,
        sourceAddress: activity.fromAddress,
        destinationAddress: activity.toAddress,
      }),
      transactionHash,
      asset: token,
      amount,
      sourceAddress: activity.fromAddress,
      destinationAddress: activity.toAddress,
      walletNetwork: networkId,
      occurredAt: new Date(),
      confirmationStatus: 'CONFIRMED',
      observationSource: 'alchemy_webhook',
      rawProviderPayload: activity as unknown as Record<string, unknown>,
    };
  }

  return null;
}

function alchemyNetworkToId(network: string): EvmNetworkId | null {
  const normalized = network.trim().toUpperCase();
  if (normalized === 'ETH_MAINNET') return 'ethereum';
  if (normalized === 'BASE_MAINNET') return 'base';
  if (normalized === 'MATIC_MAINNET' || normalized === 'POLYGON_MAINNET') return 'polygon';
  return null;
}

export async function isEvmTransactionConfirmed(
  networkId: EvmNetworkId,
  transactionHash: string
): Promise<boolean> {
  try {
    const client = createEvmPublicClient(networkId);
    const receipt = await client.getTransactionReceipt({
      hash: transactionHash as `0x${string}`,
    });
    return receipt.status === 'success';
  } catch {
    return false;
  }
}
