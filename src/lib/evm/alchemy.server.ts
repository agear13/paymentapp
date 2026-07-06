import 'server-only';

import crypto from 'crypto';
import {
  createPublicClient,
  http,
  parseEventLogs,
  erc20Abi,
  type Hash,
  type TransactionReceipt,
} from 'viem';
import {
  EVM_NETWORKS,
  getAlchemyRpcUrl,
  normalizeNetworkId,
  type EvmNetworkId,
} from '@/lib/evm/networks';
import {
  EVM_TOKENS,
  resolveTokenFromContractAddress,
  type EvmSettlementToken,
} from '@/lib/evm/tokens';

export function getAlchemyApiKey(): string | null {
  const key = process.env.ALCHEMY_API_KEY?.trim();
  return key || null;
}

export function createEvmPublicClient(networkId: EvmNetworkId) {
  const apiKey = getAlchemyApiKey();
  if (!apiKey) {
    throw new Error('ALCHEMY_API_KEY is not configured');
  }
  const network = EVM_NETWORKS[networkId];
  return createPublicClient({
    chain: network.chain,
    transport: http(getAlchemyRpcUrl(networkId, apiKey)),
  });
}

export function verifyAlchemyWebhookSignature(body: string, signature: string | null): boolean {
  const signingKey = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY?.trim();
  if (!signingKey) return true;
  if (!signature) return false;

  const expected = crypto.createHmac('sha256', signingKey).update(body, 'utf8').digest('hex');
  const provided = signature.trim().toLowerCase();
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function waitForTransactionReceipt(
  networkId: EvmNetworkId,
  transactionHash: Hash,
  options?: { maxAttempts?: number; intervalMs?: number }
): Promise<TransactionReceipt> {
  const client = createEvmPublicClient(networkId);
  const maxAttempts = options?.maxAttempts ?? 60;
  const intervalMs = options?.intervalMs ?? 5_000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const receipt = await client.getTransactionReceipt({ hash: transactionHash });
      if (receipt) return receipt;
    } catch {
      // Receipt not yet available.
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Transaction receipt not found after ${maxAttempts} attempts`);
}

export type ParsedErc20Transfer = {
  transactionHash: string;
  fromAddress: string;
  toAddress: string;
  token: EvmSettlementToken;
  tokenContractAddress: string;
  tokenAmount: string;
  blockNumber: string;
  networkId: EvmNetworkId;
};

export function parseErc20TransferFromReceipt(
  receipt: TransactionReceipt,
  networkId: EvmNetworkId,
  merchantWalletAddress: string
): ParsedErc20Transfer | null {
  const merchant = merchantWalletAddress.toLowerCase();
  const logs = parseEventLogs({
    abi: erc20Abi,
    eventName: 'Transfer',
    logs: receipt.logs,
  });

  for (const log of logs) {
    const to = String(log.args.to).toLowerCase();
    if (to !== merchant) continue;

    const token = resolveTokenFromContractAddress(log.address, networkId);
    if (!token) continue;

    const decimals = EVM_TOKENS[token].decimals;
    const rawValue = log.args.value;
    const tokenAmount = Number(rawValue) / 10 ** decimals;

    return {
      transactionHash: receipt.transactionHash,
      fromAddress: String(log.args.from),
      toAddress: String(log.args.to),
      token,
      tokenContractAddress: log.address,
      tokenAmount: tokenAmount.toString(),
      blockNumber: receipt.blockNumber.toString(),
      networkId,
    };
  }

  return null;
}

type AlchemyActivityItem = {
  hash?: string;
  fromAddress?: string;
  toAddress?: string;
  asset?: string;
  category?: string;
  rawContract?: {
    rawValue?: string;
    address?: string;
    decimals?: number;
  };
};

type AlchemyWebhookPayload = {
  type?: string;
  event?: {
    network?: string;
    activity?: AlchemyActivityItem[];
  };
};

export function parseAlchemyAddressActivity(
  payload: AlchemyWebhookPayload,
  merchantWalletAddress: string
): ParsedErc20Transfer | null {
  const networkRaw = payload.event?.network ?? '';
  const networkId = alchemyNetworkToId(networkRaw);
  if (!networkId) return null;

  const merchant = merchantWalletAddress.toLowerCase();
  const activities = payload.event?.activity ?? [];

  for (const activity of activities) {
    if (activity.category !== 'token') continue;
    if (!activity.hash || !activity.fromAddress || !activity.toAddress) continue;
    if (activity.toAddress.toLowerCase() !== merchant) continue;

    const contractAddress = activity.rawContract?.address;
    if (!contractAddress) continue;

    const token =
      resolveTokenFromContractAddress(contractAddress, networkId) ??
      (activity.asset?.toUpperCase() === 'USDC' || activity.asset?.toUpperCase() === 'USDT'
        ? (activity.asset.toUpperCase() as EvmSettlementToken)
        : null);
    if (!token) continue;

    const decimals = activity.rawContract?.decimals ?? EVM_TOKENS[token].decimals;
    const rawValueHex = activity.rawContract?.rawValue;
    if (!rawValueHex) continue;

    const rawValue = BigInt(rawValueHex);
    const tokenAmount = Number(rawValue) / 10 ** decimals;

    return {
      transactionHash: activity.hash,
      fromAddress: activity.fromAddress,
      toAddress: activity.toAddress,
      token,
      tokenContractAddress: contractAddress,
      tokenAmount: tokenAmount.toString(),
      blockNumber: '0',
      networkId,
    };
  }

  return null;
}

function alchemyNetworkToId(network: string): EvmNetworkId | null {
  const normalized = network.trim().toUpperCase();
  if (normalized === 'ETH_MAINNET') return 'ethereum';
  if (normalized === 'BASE_MAINNET') return 'base';
  if (normalized === 'MATIC_MAINNET' || normalized === 'POLYGON_MAINNET') return 'polygon';
  return normalizeNetworkId(network.replace(/_/g, '-').toLowerCase());
}
