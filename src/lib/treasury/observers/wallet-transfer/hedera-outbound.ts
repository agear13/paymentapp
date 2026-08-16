import { CURRENT_MIRROR_URL, TOKEN_CONFIG, type TokenType } from '@/lib/hedera/constants';
import { fromSmallestUnit } from '@/lib/hedera/token-service';
import type { MirrorTransaction } from '@/lib/hedera/types';
import type { ObservedOutboundTransfer } from '@/lib/treasury/observers/wallet-transfer/types';

const OBSERVED_HEDERA_ASSETS: TokenType[] = ['HBAR', 'USDC', 'USDT'];

export function buildHederaOutboundProviderReference(params: {
  transactionId: string;
  asset: string;
  sourceAccount: string;
  destinationAccount: string;
}): string {
  return `hedera:outbound:${params.transactionId}:${params.asset}:${params.sourceAccount}:${params.destinationAccount}`;
}

function tokenTypeFromTokenId(tokenId: string): TokenType | null {
  for (const asset of ['USDC', 'USDT'] as const) {
    if (TOKEN_CONFIG[asset].id === tokenId) return asset;
  }
  return null;
}

export function parseHederaOutboundTransfer(
  tx: MirrorTransaction,
  merchantAccountId: string
): ObservedOutboundTransfer | null {
  if (tx.result !== 'SUCCESS') return null;

  const hbarOutbound = tx.transfers?.find(
    (t) => t.account === merchantAccountId && t.amount < 0
  );

  if (hbarOutbound) {
    const destination = tx.transfers?.find(
      (t) => t.account !== merchantAccountId && t.amount > 0
    );
    if (!destination) return null;

    const amount = fromSmallestUnit(Math.abs(hbarOutbound.amount), 'HBAR').toString();
    const occurredAt = hederaTimestampToDate(tx.consensus_timestamp);

    return {
      providerReference: buildHederaOutboundProviderReference({
        transactionId: tx.transaction_id,
        asset: 'HBAR',
        sourceAccount: merchantAccountId,
        destinationAccount: destination.account,
      }),
      transactionHash: tx.transaction_id,
      asset: 'HBAR',
      amount,
      sourceAddress: merchantAccountId,
      destinationAddress: destination.account,
      walletNetwork: 'hedera',
      occurredAt,
      confirmationStatus: 'CONFIRMED',
      observationSource: 'hedera_mirror',
      rawProviderPayload: tx as unknown as Record<string, unknown>,
    };
  }

  const tokenOutbound = tx.token_transfers?.find(
    (t) => t.account === merchantAccountId && t.amount < 0
  );

  if (!tokenOutbound) return null;

  const asset = tokenTypeFromTokenId(tokenOutbound.token_id);
  if (!asset || !OBSERVED_HEDERA_ASSETS.includes(asset) || asset === 'HBAR') return null;

  const destination = tx.token_transfers?.find(
    (t) =>
      t.token_id === tokenOutbound.token_id &&
      t.account !== merchantAccountId &&
      t.amount > 0
  );

  if (!destination) return null;

  const amount = fromSmallestUnit(Math.abs(tokenOutbound.amount), asset).toString();
  const occurredAt = hederaTimestampToDate(tx.consensus_timestamp);

  return {
    providerReference: buildHederaOutboundProviderReference({
      transactionId: tx.transaction_id,
      asset,
      sourceAccount: merchantAccountId,
      destinationAccount: destination.account,
    }),
    transactionHash: tx.transaction_id,
    asset,
    amount,
    sourceAddress: merchantAccountId,
    destinationAddress: destination.account,
    walletNetwork: 'hedera',
    occurredAt,
    confirmationStatus: 'CONFIRMED',
    observationSource: 'hedera_mirror',
    rawProviderPayload: tx as unknown as Record<string, unknown>,
  };
}

function hederaTimestampToDate(consensusTimestamp: string): Date {
  const seconds = Number.parseFloat(consensusTimestamp);
  return new Date(seconds * 1000);
}

export async function fetchHederaOutboundTransfers(params: {
  merchantAccountId: string;
  since?: Date | null;
  limit?: number;
}): Promise<ObservedOutboundTransfer[]> {
  let url = `${CURRENT_MIRROR_URL}/api/v1/transactions?account.id=${encodeURIComponent(params.merchantAccountId)}&limit=${params.limit ?? 50}&order=desc&transactionType=CRYPTOTRANSFER,TOKENTRANSFER`;

  if (params.since) {
    const timestamp = Math.floor(params.since.getTime() / 1000);
    url += `&timestamp=gte:${timestamp}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Hedera mirror query failed (${response.status})`);
  }

  const data = (await response.json()) as { transactions?: MirrorTransaction[] };
  const observed: ObservedOutboundTransfer[] = [];

  for (const tx of data.transactions ?? []) {
    const parsed = parseHederaOutboundTransfer(tx, params.merchantAccountId);
    if (parsed) observed.push(parsed);
  }

  return observed;
}
