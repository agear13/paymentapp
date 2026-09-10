import { cregisSignedPost, CREGIS_SUCCESS_CODE } from '@/lib/payouts/rails/cregis-http';
import type { CregisExecutionCredentials } from '@/lib/payouts/rails/types';
import { PayoutReleaseError } from '@/lib/payouts/payout-status-transitions';

/** Documented read-only project capability endpoint. Never creates a payout. */
export const CREGIS_COINS_PATH = '/api/v1/coins';

export type CregisProjectCoin = {
  coinName: string;
  chainId: string;
  tokenId: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseCoinList(value: unknown): CregisProjectCoin[] {
  if (!Array.isArray(value)) return [];
  const coins: CregisProjectCoin[] = [];
  for (const row of value) {
    const record = asRecord(row);
    if (!record) continue;
    const chainId = typeof record.chain_id === 'string' ? record.chain_id : null;
    const tokenId = typeof record.token_id === 'string' ? record.token_id : null;
    if (!chainId || !tokenId) continue;
    coins.push({
      coinName: typeof record.coin_name === 'string' ? record.coin_name : '',
      chainId,
      tokenId,
    });
  }
  return coins;
}

export function parseCregisProjectCoins(data: unknown): {
  payoutCoins: CregisProjectCoin[];
  addressCoins: CregisProjectCoin[];
} {
  const record = asRecord(data);
  return {
    payoutCoins: parseCoinList(record?.payout_coins),
    addressCoins: parseCoinList(record?.address_coins),
  };
}

export function cregisCurrencyInProjectCoins(
  coins: readonly CregisProjectCoin[],
  currency: string
): boolean {
  const trimmed = currency.trim();
  const byName = coins.some(
    (coin) => coin.coinName && coin.coinName.toLowerCase() === trimmed.toLowerCase()
  );
  if (byName) return true;
  const at = trimmed.indexOf('@');
  if (at <= 0) return false;
  const chainId = trimmed.slice(0, at);
  const tokenId = trimmed.slice(at + 1);
  return coins.some(
    (coin) =>
      coin.chainId === chainId && coin.tokenId.toLowerCase() === tokenId.toLowerCase()
  );
}

export async function queryCregisProjectCoins(
  credentials: CregisExecutionCredentials,
  fetchImpl?: typeof fetch
): Promise<{
  endpoint: string;
  payoutCoins: CregisProjectCoin[];
  addressCoins: CregisProjectCoin[];
}> {
  const endpoint = `${credentials.gatewayBaseUrl}${CREGIS_COINS_PATH}`;
  const response = await cregisSignedPost({
    credentials,
    path: CREGIS_COINS_PATH,
    body: { pid: credentials.pid },
    fetchImpl,
  });
  if (response.code !== CREGIS_SUCCESS_CODE) {
    throw new PayoutReleaseError(
      'CREGIS_COINS_QUERY_FAILED',
      response.msg || `Cregis coins query failed (${response.code ?? 'unknown'})`,
      502
    );
  }
  const parsed = parseCregisProjectCoins(response.data);
  return { endpoint, ...parsed };
}
