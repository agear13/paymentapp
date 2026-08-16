import type { IngestTreasuryEventInput } from '@/lib/treasury/events/types';

export type NormalizedExchangeRecord = Omit<
  IngestTreasuryEventInput,
  'organizationId'
> & {
  /** Additional fee event when aud_fee is present */
  feeEvent?: Omit<IngestTreasuryEventInput, 'organizationId'>;
};

export type ExchangeConnectionHealth = {
  healthy: boolean;
  checkedAt: string;
  providerAccountLabel?: string | null;
  error?: string | null;
};

export type ExchangeDepositAddress = {
  asset: string;
  address: string;
  active: boolean;
  providerAddressId?: string | number | null;
};

export type ExchangeBalanceSnapshot = {
  asset: string;
  balance: string;
  audValue?: string | null;
};

export type ExchangeSyncCursor = {
  lastCreatedAt?: string | null;
  lastSummaryId?: number | null;
};

export type ExchangeConnector = {
  readonly providerId: string;
  checkConnectionHealth(params: { organizationId: string }): Promise<ExchangeConnectionHealth>;
  fetchTransactions(params: {
    organizationId: string;
    since?: Date | null;
    cursor?: ExchangeSyncCursor | null;
  }): Promise<{ records: NormalizedExchangeRecord[]; cursor: ExchangeSyncCursor }>;
  fetchTransactionDetails?(params: {
    organizationId: string;
    asset: string;
    transactionId: number | string;
  }): Promise<NormalizedExchangeRecord[]>;
  fetchDepositAddresses(params: {
    organizationId: string;
    assets?: string[];
  }): Promise<ExchangeDepositAddress[]>;
};

export type ExchangeBalanceConnector = ExchangeConnector & {
  fetchBalances(params: { organizationId: string }): Promise<ExchangeBalanceSnapshot[]>;
};
