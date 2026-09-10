/**
 * Official Cregis currency identifiers from
 * https://developer.cregis.com/api-reference/currency-identifiers
 *
 * Only these documented tokens are used. Provvy does not invent FX or
 * undocumented chain/token ids.
 */

export type CregisCurrencyRecord = {
  name: string;
  chainId: string;
  tokenId: string;
  decimals: number;
  asset: string;
  network: string;
};

export const CREGIS_DOCUMENTED_CURRENCIES: readonly CregisCurrencyRecord[] = [
  { name: 'Bitcoin', chainId: '0', tokenId: '0', decimals: 8, asset: 'BTC', network: 'bitcoin' },
  { name: 'Ethereum', chainId: '60', tokenId: '60', decimals: 18, asset: 'ETH', network: 'ethereum' },
  {
    name: 'USDT-ERC20',
    chainId: '60',
    tokenId: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    decimals: 6,
    asset: 'USDT',
    network: 'ethereum',
  },
  {
    name: 'USDC-ERC20',
    chainId: '60',
    tokenId: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    decimals: 6,
    asset: 'USDC',
    network: 'ethereum',
  },
  { name: 'TRON', chainId: '195', tokenId: '195', decimals: 6, asset: 'TRX', network: 'tron' },
  {
    name: 'USDT-TRC20',
    chainId: '195',
    tokenId: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    decimals: 6,
    asset: 'USDT',
    network: 'tron',
  },
  {
    name: 'USDC-TRC20',
    chainId: '195',
    tokenId: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
    decimals: 6,
    asset: 'USDC',
    network: 'tron',
  },
  { name: 'BNB-BSC', chainId: '2510', tokenId: '2510', decimals: 18, asset: 'BNB', network: 'bsc' },
  {
    name: 'USDT-BEP20',
    chainId: '2510',
    tokenId: '0x55d398326f99059ff775485246999027b3197955',
    decimals: 18,
    asset: 'USDT',
    network: 'bsc',
  },
  {
    name: 'USDC-BEP20',
    chainId: '2510',
    tokenId: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
    decimals: 18,
    asset: 'USDC',
    network: 'bsc',
  },
  { name: 'POL-Polygon', chainId: '62', tokenId: '62', decimals: 18, asset: 'POL', network: 'polygon' },
  {
    name: 'USDT-Polygon',
    chainId: '62',
    tokenId: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
    decimals: 6,
    asset: 'USDT',
    network: 'polygon',
  },
  {
    name: 'USDC-Polygon',
    chainId: '62',
    tokenId: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
    decimals: 6,
    asset: 'USDC',
    network: 'polygon',
  },
  { name: 'Solana', chainId: '1000', tokenId: '1000', decimals: 9, asset: 'SOL', network: 'solana' },
  {
    name: 'USDT-Solana',
    chainId: '1000',
    tokenId: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
    asset: 'USDT',
    network: 'solana',
  },
  {
    name: 'USDC-Solana',
    chainId: '1000',
    tokenId: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    asset: 'USDC',
    network: 'solana',
  },
  { name: 'TON', chainId: '2000', tokenId: '2000', decimals: 9, asset: 'TON', network: 'ton' },
  {
    name: 'USDT-Jetton',
    chainId: '2000',
    tokenId: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
    decimals: 6,
    asset: 'USDT',
    network: 'ton',
  },
  { name: 'XRP-Ripple', chainId: '144', tokenId: '144', decimals: 6, asset: 'XRP', network: 'xrp' },
] as const;

const NETWORK_ALIASES: Record<string, string> = {
  eth: 'ethereum',
  ethereum: 'ethereum',
  erc20: 'ethereum',
  ethereum_mainnet: 'ethereum',
  tron: 'tron',
  trc20: 'tron',
  trx: 'tron',
  bsc: 'bsc',
  binance: 'bsc',
  bep20: 'bsc',
  bnb: 'bsc',
  polygon: 'polygon',
  matic: 'polygon',
  sol: 'solana',
  solana: 'solana',
  ton: 'ton',
  xrp: 'xrp',
  ripple: 'xrp',
  bitcoin: 'bitcoin',
  btc: 'bitcoin',
};

export function normalizeCregisNetwork(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return NETWORK_ALIASES[value.trim().toLowerCase()] ?? value.trim().toLowerCase();
}

export function cregisCurrencyIdentifier(record: CregisCurrencyRecord): string {
  return `${record.chainId}@${record.tokenId}`;
}

export function findCregisCurrencyByIdentifier(value: string): CregisCurrencyRecord | null {
  const trimmed = value.trim();
  const byName = CREGIS_DOCUMENTED_CURRENCIES.find(
    (row) => row.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (byName) return byName;
  const byPair = CREGIS_DOCUMENTED_CURRENCIES.find(
    (row) => cregisCurrencyIdentifier(row).toLowerCase() === trimmed.toLowerCase()
  );
  return byPair ?? null;
}

export function findCregisCurrencyByAssetNetwork(
  asset: string | null | undefined,
  network: string | null | undefined
): CregisCurrencyRecord | null {
  const normalizedAsset = asset?.trim().toUpperCase();
  const normalizedNetwork = normalizeCregisNetwork(network);
  if (!normalizedAsset || !normalizedNetwork) return null;
  return (
    CREGIS_DOCUMENTED_CURRENCIES.find(
      (row) => row.asset === normalizedAsset && row.network === normalizedNetwork
    ) ?? null
  );
}

export type CregisDestinationResolution = {
  address: string;
  currency: string;
  record: CregisCurrencyRecord;
  memo?: string;
};

function readDetailString(
  details: Record<string, unknown> | null | undefined,
  keys: string[]
): string | null {
  if (!details) return null;
  for (const key of keys) {
    const value = details[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Resolve a Cregis payout currency from destination metadata only.
 * Does not treat Provvy Char(3) fiat codes (USD/AUD) as Cregis tokens.
 */
export function resolveCregisDestination(input: {
  handle?: string | null;
  details?: Record<string, unknown> | null;
}): CregisDestinationResolution | null {
  const details = input.details ?? null;
  const address =
    readDetailString(details, ['address', 'walletAddress', 'toAddress', 'to_address']) ??
    input.handle?.trim() ??
    null;
  if (!address) return null;

  const explicit =
    readDetailString(details, ['currency', 'cregisCurrency', 'currencyIdentifier']) ?? null;
  const record = explicit
    ? findCregisCurrencyByIdentifier(explicit)
    : findCregisCurrencyByAssetNetwork(
        readDetailString(details, ['asset', 'token', 'tokenSymbol']),
        readDetailString(details, ['network', 'chain', 'chainName'])
      );
  if (!record) return null;

  const memo = readDetailString(details, ['memo', 'tag']) ?? undefined;
  return {
    address,
    currency: explicit && findCregisCurrencyByIdentifier(explicit)
      ? explicit.includes('@')
        ? explicit
        : cregisCurrencyIdentifier(record)
      : cregisCurrencyIdentifier(record),
    record,
    memo,
  };
}

/**
 * USD stablecoins whose token units can be sent as the Provvy USD net amount
 * without inventing an FX rate. Cregis does not document a quote/FX API.
 */
export const CREGIS_USD_STABLECOIN_ASSETS = new Set(['USDT', 'USDC']);

export type CregisSubmitAmountResolution = {
  amount: string;
  source: 'explicit_token_amount' | 'token_units_flag' | 'usd_stablecoin';
};

function readDetailAmount(
  details: Record<string, unknown> | null | undefined,
  keys: string[]
): string | null {
  if (!details) return null;
  for (const key of keys) {
    const value = details[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return String(value);
    }
    if (typeof value === 'string' && value.trim() && Number(value) > 0) {
      return value.trim();
    }
  }
  return null;
}

/**
 * Resolve the Cregis `amount` without inventing FX.
 *
 * Cregis documents amount as token units. Provvy `payouts.currency` is a
 * Char(3) fiat code, so USD/AUD must not be sent as BTC/ETH/etc.
 */
export function resolveCregisSubmitAmount(input: {
  payoutAmount: string;
  payoutCurrency: string;
  details?: Record<string, unknown> | null;
  record: CregisCurrencyRecord;
}): CregisSubmitAmountResolution | null {
  const explicit = readDetailAmount(input.details, ['tokenAmount', 'cregisAmount']);
  if (explicit) {
    return { amount: explicit, source: 'explicit_token_amount' };
  }

  const payoutAmount = input.payoutAmount.trim();
  if (!payoutAmount || !(Number(payoutAmount) > 0)) return null;

  if (input.details?.amountIsTokenUnits === true) {
    return { amount: payoutAmount, source: 'token_units_flag' };
  }

  const fiat = input.payoutCurrency.trim().toUpperCase();
  if (fiat === 'USD' && CREGIS_USD_STABLECOIN_ASSETS.has(input.record.asset)) {
    return { amount: payoutAmount, source: 'usd_stablecoin' };
  }

  return null;
}

export function isCregisDestinationExecutable(input: {
  handle?: string | null;
  details?: Record<string, unknown> | null;
  methodType?: string | null;
  payoutAmount?: string;
  payoutCurrency?: string;
}): boolean {
  if (input.methodType === 'HEDERA') return false;
  const destination = resolveCregisDestination(input);
  if (!destination) return false;
  if (input.payoutAmount == null || input.payoutCurrency == null) {
    return true;
  }
  return (
    resolveCregisSubmitAmount({
      payoutAmount: input.payoutAmount,
      payoutCurrency: input.payoutCurrency,
      details: input.details,
      record: destination.record,
    }) != null
  );
}
