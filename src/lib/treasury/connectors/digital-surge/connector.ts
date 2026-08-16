import { getDigitalSurgeConnection } from '@/lib/treasury/integration/connection-service';
import { DigitalSurgeClient, DigitalSurgeApiError } from '@/lib/treasury/connectors/digital-surge/client';
import {
  extractDigitalSurgeTxHash,
  normalizeDigitalSurgeTransaction,
} from '@/lib/treasury/connectors/digital-surge/normalize';
import type {
  ExchangeBalanceConnector,
  ExchangeBalanceSnapshot,
  ExchangeConnectionHealth,
  ExchangeDepositAddress,
  ExchangeSyncCursor,
  NormalizedExchangeRecord,
} from '@/lib/treasury/connectors/exchange-connector.types';
import type { DigitalSurgeAllTransaction } from '@/lib/treasury/connectors/digital-surge/types';
import { TREASURY_PROVIDERS } from '@/lib/treasury/events/types';

const SYNC_ASSETS = ['USDC', 'USDT', 'AUD'];
const DEPOSIT_ADDRESS_ASSETS = ['USDC', 'USDT'];
const MAX_PAGES = 20;

/**
 * Read-only Digital Surge connector — observation + reconciliation only.
 */
export class DigitalSurgeConnector implements ExchangeBalanceConnector {
  readonly providerId = TREASURY_PROVIDERS.DIGITAL_SURGE;

  async checkConnectionHealth(params: {
    organizationId: string;
  }): Promise<ExchangeConnectionHealth> {
    const checkedAt = new Date().toISOString();
    const connection = await getDigitalSurgeConnection(params.organizationId);
    if (!connection) {
      return { healthy: false, checkedAt, error: 'not_connected' };
    }

    try {
      const client = new DigitalSurgeClient(connection.apiKey);
      const profile = await client.getProfileBrief();
      const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
      const label = profile.email ?? (name || null);
      return {
        healthy: true,
        checkedAt,
        providerAccountLabel: label,
        error: null,
      };
    } catch (error) {
      return {
        healthy: false,
        checkedAt,
        error: error instanceof DigitalSurgeApiError ? `api_${error.status}` : 'connection_failed',
      };
    }
  }

  async fetchDepositAddresses(params: {
    organizationId: string;
    assets?: string[];
  }): Promise<ExchangeDepositAddress[]> {
    const connection = await getDigitalSurgeConnection(params.organizationId);
    if (!connection) return [];

    const client = new DigitalSurgeClient(connection.apiKey);
    const assets = params.assets ?? DEPOSIT_ADDRESS_ASSETS;
    const addresses: ExchangeDepositAddress[] = [];

    for (const asset of assets) {
      try {
        const response = await client.listDepositAddresses(asset);
        for (const row of response.results) {
          if (!row.raw_address?.trim()) continue;
          addresses.push({
            asset: asset.toUpperCase(),
            address: row.raw_address.trim(),
            active: row.active === true || row.active === 'true',
            providerAddressId: row.id,
          });
        }
      } catch (error) {
        if (error instanceof DigitalSurgeApiError && error.status === 404) continue;
        throw error;
      }
    }

    return addresses;
  }

  async fetchTransactions(params: {
    organizationId: string;
    since?: Date | null;
    cursor?: ExchangeSyncCursor | null;
  }): Promise<{ records: NormalizedExchangeRecord[]; cursor: ExchangeSyncCursor }> {
    const connection = await getDigitalSurgeConnection(params.organizationId);
    if (!connection) return { records: [], cursor: {} };

    const client = new DigitalSurgeClient(connection.apiKey);
    const sinceMs =
      params.since?.getTime() ??
      (params.cursor?.lastCreatedAt ? new Date(params.cursor.lastCreatedAt).getTime() : 0);

    const seenRefs = new Set<string>();
    const records: NormalizedExchangeRecord[] = [];
    let maxCreatedMs = sinceMs;
    let maxSummaryId = params.cursor?.lastSummaryId ?? 0;

    const ingestTx = async (tx: DigitalSurgeAllTransaction, enrich = false) => {
      let enriched = tx;
      if (
        enrich &&
        tx.transaction_type === 'deposit' &&
        !extractDigitalSurgeTxHash(tx) &&
        tx.src_asset
      ) {
        try {
          enriched = await client.getWalletTransaction(tx.src_asset, tx.id, 'json');
        } catch {
          /* detail enrichment optional */
        }
      }

      for (const record of normalizeDigitalSurgeTransaction(enriched)) {
        if (seenRefs.has(record.providerReference)) continue;
        seenRefs.add(record.providerReference);
        records.push(record);
      }

      const createdMs = new Date(tx.created).getTime();
      if (createdMs > maxCreatedMs) maxCreatedMs = createdMs;
      if (tx.summary_id > maxSummaryId) maxSummaryId = tx.summary_id;
    };

    let page = 1;
    let hasMore = true;
    while (hasMore && page <= MAX_PAGES) {
      const response = await client.listAllTransactions({
        page,
        pageSize: 100,
        format: 'json',
        time: sinceMs === 0 ? 'year' : undefined,
      });

      let stoppedEarly = false;
      for (const tx of response.results) {
        const createdMs = new Date(tx.created).getTime();
        if (sinceMs > 0 && createdMs < sinceMs - 3_600_000) {
          stoppedEarly = true;
          break;
        }
        await ingestTx(tx, true);
      }

      if (stoppedEarly || !response.next) hasMore = false;
      else page += 1;
    }

    for (const asset of SYNC_ASSETS) {
      let assetPage = 1;
      let assetHasMore = true;
      while (assetHasMore && assetPage <= 10) {
        const walletTx = await client.listWalletTransactions(asset, {
          page: assetPage,
          pageSize: 100,
          format: 'json',
        });
        let stoppedEarly = false;
        for (const tx of walletTx.results) {
          const createdMs = new Date(tx.created).getTime();
          if (sinceMs > 0 && createdMs < sinceMs - 3_600_000) {
            stoppedEarly = true;
            break;
          }
          await ingestTx(tx, false);
        }
        if (stoppedEarly || !walletTx.next) assetHasMore = false;
        else assetPage += 1;
      }
    }

    return {
      records,
      cursor: {
        lastCreatedAt: new Date(maxCreatedMs).toISOString(),
        lastSummaryId: maxSummaryId,
      },
    };
  }

  async fetchTransactionDetails(params: {
    organizationId: string;
    asset: string;
    transactionId: number | string;
  }): Promise<NormalizedExchangeRecord[]> {
    const connection = await getDigitalSurgeConnection(params.organizationId);
    if (!connection) return [];

    const client = new DigitalSurgeClient(connection.apiKey);
    const tx = await client.getWalletTransaction(params.asset, params.transactionId, 'json');
    return normalizeDigitalSurgeTransaction(tx);
  }

  async fetchBalances(params: { organizationId: string }): Promise<ExchangeBalanceSnapshot[]> {
    const connection = await getDigitalSurgeConnection(params.organizationId);
    if (!connection) return [];

    const client = new DigitalSurgeClient(connection.apiKey);
    const response = await client.listBalances();
    const snapshots: ExchangeBalanceSnapshot[] = [];

    for (const row of response.results) {
      for (const [asset, balance] of Object.entries(row.available ?? {})) {
        snapshots.push({
          asset: asset.toUpperCase(),
          balance,
          audValue: row.total?.AUD ?? null,
        });
      }
    }

    return snapshots;
  }
}

export const digitalSurgeConnector = new DigitalSurgeConnector();
