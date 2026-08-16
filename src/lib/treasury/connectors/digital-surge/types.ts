/** Digital Surge API response shapes (read-only endpoints). */

export type DigitalSurgeTransactionType =
  | 'buy'
  | 'sell'
  | 'swap'
  | 'deposit'
  | 'withdrawal'
  | 'commission'
  | 'airdrop'
  | 'stake'
  | 'unstake'
  | 'reward';

export type DigitalSurgeAllTransaction = {
  summary_id: number;
  id: number;
  object_id: number;
  created: string;
  src_asset: string | null;
  dst_asset: string | null;
  src_amount: string | null;
  dst_amount: string | null;
  quote_cost: string | null;
  exchange_rate: string | null;
  cost: string | null;
  fee: string | null;
  aud_fee: string | null;
  aud_value: string | null;
  fee_currency: string | null;
  status: string;
  transaction_type: DigitalSurgeTransactionType;
  transaction_subtype: string;
  /** May be present in format=json detail responses — not guaranteed in OpenAPI list schema */
  blockchain_tx_hash?: string | null;
  tx_hash?: string | null;
  txid?: string | null;
  deposit_address?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type DigitalSurgePaginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type DigitalSurgeDepositAddress = {
  id: number;
  received: string;
  active: boolean | string;
  raw_address: string | null;
};

export type DigitalSurgeProfileBrief = {
  first_name?: string;
  last_name?: string;
  email?: string;
  account_verification?: string;
  verified_account?: boolean;
};

export type DigitalSurgeBalanceRow = {
  total: Record<string, string>;
  available: Record<string, string>;
  withdrawable: Record<string, string>;
};
