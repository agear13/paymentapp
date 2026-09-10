import {
  CREGIS_DOCUMENTED_CURRENCIES,
  findCregisCurrencyByAssetNetwork,
  findCregisCurrencyByIdentifier,
  normalizeCregisNetwork,
} from '@/lib/payouts/rails/cregis-currency';

/**
 * Canonical crypto destination metadata stored on payout_methods.details.
 * Keys match what rail adapters already read. Not provider-specific columns.
 */
export const CRYPTO_DESTINATION_DETAIL_KEYS = [
  'address',
  'walletAddress',
  'toAddress',
  'to_address',
  'asset',
  'token',
  'tokenSymbol',
  'network',
  'chain',
  'chainName',
  'currency',
  'cregisCurrency',
  'currencyIdentifier',
  'memo',
  'tag',
  'tokenAmount',
  'cregisAmount',
  'amountIsTokenUnits',
] as const;

export type CryptoDestinationDetailKey = (typeof CRYPTO_DESTINATION_DETAIL_KEYS)[number];

const SECRET_DETAIL_KEY_PATTERN =
  /^(api[_-]?key|api[_-]?secret|secret|private[_-]?key|password|sign|signature|seed|mnemonic|credential|encrypted[_-]?api[_-]?key|authorization|bearer|access[_-]?token|refresh[_-]?token)$/i;

const WALLET_ADDRESS_PATTERN = /^[a-zA-Z0-9:._-]{8,256}$/;
const ASSET_PATTERN = /^[A-Za-z0-9.-]{2,16}$/;
const CURRENCY_IDENTIFIER_PATTERN = /^\d+@[A-Za-z0-9]+$/;

export type CryptoDestinationNetworkOption = {
  id: string;
  label: string;
};

export type CryptoDestinationAssetOption = {
  asset: string;
  network: string;
  label: string;
};

const NETWORK_LABELS: Record<string, string> = {
  bitcoin: 'Bitcoin',
  ethereum: 'Ethereum',
  tron: 'Tron',
  bsc: 'BNB Smart Chain',
  polygon: 'Polygon',
  solana: 'Solana',
  ton: 'TON',
  xrp: 'XRP',
};

export const CRYPTO_DESTINATION_NETWORKS: readonly CryptoDestinationNetworkOption[] = [
  ...new Map(
    CREGIS_DOCUMENTED_CURRENCIES.map((row) => [
      row.network,
      { id: row.network, label: NETWORK_LABELS[row.network] ?? row.network },
    ])
  ).values(),
];

export const CRYPTO_DESTINATION_ASSETS: readonly CryptoDestinationAssetOption[] =
  CREGIS_DOCUMENTED_CURRENCIES.map((row) => ({
    asset: row.asset,
    network: row.network,
    label: `${row.asset} on ${NETWORK_LABELS[row.network] ?? row.network}`,
  }));

export function cryptoNetworksForAsset(asset: string): CryptoDestinationNetworkOption[] {
  const normalized = asset.trim().toUpperCase();
  const networks = new Set(
    CREGIS_DOCUMENTED_CURRENCIES.filter((row) => row.asset === normalized).map((row) => row.network)
  );
  return CRYPTO_DESTINATION_NETWORKS.filter((network) => networks.has(network.id));
}

export function cryptoDestinationNeedsMemo(network: string | null | undefined): boolean {
  const normalized = normalizeCregisNetwork(network);
  return normalized === 'ton' || normalized === 'xrp';
}

export type PayoutMethodDetails = Record<string, string | number | boolean>;

export type PayoutMethodDetailsResult =
  | { ok: true; details: PayoutMethodDetails | null }
  | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function detailsContainSecrets(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return Object.keys(value).some((key) => SECRET_DETAIL_KEY_PATTERN.test(key));
}

function readTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function sanitizeAmount(value: unknown): string | number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string' && value.trim() && Number(value) > 0) return value.trim();
  return null;
}

export function sanitizePayoutMethodDetails(value: unknown): PayoutMethodDetailsResult {
  if (value == null) return { ok: true, details: null };
  if (!isPlainObject(value)) {
    return { ok: false, error: 'details must be an object' };
  }
  if (detailsContainSecrets(value)) {
    return { ok: false, error: 'details cannot include credentials or signing material' };
  }

  const allowed = new Set<string>(CRYPTO_DESTINATION_DETAIL_KEYS);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    return { ok: false, error: `details contains unsupported fields: ${unknown.join(', ')}` };
  }

  const details: PayoutMethodDetails = {};
  for (const key of CRYPTO_DESTINATION_DETAIL_KEYS) {
    const raw = value[key];
    if (raw == null || raw === '') continue;
    if (key === 'amountIsTokenUnits') {
      if (typeof raw !== 'boolean') {
        return { ok: false, error: 'amountIsTokenUnits must be a boolean' };
      }
      details[key] = raw;
      continue;
    }
    if (key === 'tokenAmount' || key === 'cregisAmount') {
      const amount = sanitizeAmount(raw);
      if (amount == null) {
        return { ok: false, error: `${key} must be a positive amount` };
      }
      details[key] = amount;
      continue;
    }
    const text = readTrimmedString(raw);
    if (!text) {
      return { ok: false, error: `${key} must be a non-empty string` };
    }
    details[key] = text;
  }

  return { ok: true, details: Object.keys(details).length > 0 ? details : null };
}

function destinationAddress(details: PayoutMethodDetails | null, handle?: string | null): string | null {
  if (details) {
    for (const key of ['address', 'walletAddress', 'toAddress', 'to_address'] as const) {
      const value = details[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return handle?.trim() || null;
}

function destinationCurrencyHint(details: PayoutMethodDetails): string | null {
  for (const key of ['currency', 'cregisCurrency', 'currencyIdentifier'] as const) {
    const value = details[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function validateCryptoPayoutMethodDetails(input: {
  handle?: string | null;
  details?: unknown;
}): PayoutMethodDetailsResult {
  const sanitized = sanitizePayoutMethodDetails(input.details);
  if (!sanitized.ok) return sanitized;
  if (!sanitized.details) return { ok: true, details: null };

  const details = sanitized.details;
  const address = destinationAddress(details, input.handle);
  if (address && !WALLET_ADDRESS_PATTERN.test(address)) {
    return { ok: false, error: 'Wallet address looks invalid' };
  }

  const asset =
    readTrimmedString(details.asset) ??
    readTrimmedString(details.token) ??
    readTrimmedString(details.tokenSymbol);
  const network =
    normalizeCregisNetwork(
      readTrimmedString(details.network) ??
        readTrimmedString(details.chain) ??
        readTrimmedString(details.chainName)
    );
  const currency = destinationCurrencyHint(details);

  if (asset && !ASSET_PATTERN.test(asset)) {
    return { ok: false, error: 'Asset looks invalid' };
  }
  if ((asset && !network && !currency) || (network && !asset && !currency)) {
    return { ok: false, error: 'Crypto destinations require both asset and network' };
  }
  if (currency && !findCregisCurrencyByIdentifier(currency) && !CURRENCY_IDENTIFIER_PATTERN.test(currency)) {
    return { ok: false, error: 'Currency identifier looks invalid' };
  }
  if (asset && network && !findCregisCurrencyByAssetNetwork(asset, network) && !currency) {
    return { ok: false, error: `Unsupported asset/network combination: ${asset} on ${network}` };
  }

  if (cryptoDestinationNeedsMemo(network)) {
    const memo = readTrimmedString(details.memo) ?? readTrimmedString(details.tag);
    if (memo && memo.length > 128) {
      return { ok: false, error: 'Memo/tag must be 128 characters or fewer' };
    }
  }

  return { ok: true, details };
}

export function persistablePayoutMethodDetails(input: {
  methodType: string;
  handle?: string | null;
  details?: unknown;
}): PayoutMethodDetailsResult {
  if (input.methodType === 'CRYPTO') {
    const validated = validateCryptoPayoutMethodDetails(input);
    if (!validated.ok) return validated;
    if (!validated.details) return { ok: true, details: null };
    const address = destinationAddress(validated.details, input.handle);
    if (address && !validated.details.address) {
      return { ok: true, details: { ...validated.details, address } };
    }
    return validated;
  }

  return sanitizePayoutMethodDetails(input.details);
}

export function publicPayoutMethodDetails(value: unknown): PayoutMethodDetails | null {
  const sanitized = sanitizePayoutMethodDetails(value);
  return sanitized.ok ? sanitized.details : null;
}

export function resolveCryptoHandle(input: {
  handle?: string | null;
  details?: PayoutMethodDetails | null;
}): string | undefined {
  return destinationAddress(input.details ?? null, input.handle) ?? undefined;
}
