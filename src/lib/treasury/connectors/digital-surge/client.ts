import { loggers } from '@/lib/logger';
import type {
  DigitalSurgeAllTransaction,
  DigitalSurgeBalanceRow,
  DigitalSurgeDepositAddress,
  DigitalSurgePaginated,
  DigitalSurgeProfileBrief,
} from '@/lib/treasury/connectors/digital-surge/types';

const log = loggers.jobs;

const DEFAULT_BASE_URL = 'https://app.digitalsurge.com.au';

export class DigitalSurgeApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'DigitalSurgeApiError';
  }
}

/**
 * Read-only Digital Surge HTTP client.
 * Never implements swap, withdraw, or transfer endpoints.
 */
export class DigitalSurgeClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = process.env.DIGITAL_SURGE_API_BASE_URL?.trim() || DEFAULT_BASE_URL
  ) {}

  private async get<T>(path: string, query?: Record<string, string>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      log.warn('Digital Surge API request failed', {
        path,
        status: response.status,
        bodyLength: body.length,
      });
      throw new DigitalSurgeApiError(
        `Digital Surge API error (${response.status})`,
        response.status
      );
    }

    return (await response.json()) as T;
  }

  /** GET /api/private/profile/brief/ — connection health / account identity */
  async getProfileBrief(): Promise<DigitalSurgeProfileBrief> {
    return this.get('/api/private/profile/brief/');
  }

  /** GET /api/private/wallet/all-transactions/ */
  async listAllTransactions(params?: {
    page?: number;
    pageSize?: number;
    format?: 'json' | 'concise';
    transactionType?: string;
    asset?: string;
    time?: '24h' | 'week' | 'month' | 'year';
  }): Promise<DigitalSurgePaginated<DigitalSurgeAllTransaction>> {
    const query: Record<string, string> = {};
    if (params?.page) query.page = String(params.page);
    if (params?.pageSize) query.page_size = String(params.pageSize);
    if (params?.format) query.format = params.format;
    if (params?.transactionType) query.transaction_type = params.transactionType;
    if (params?.asset) query.asset = params.asset;
    if (params?.time) query.time = params.time;
    return this.get('/api/private/wallet/all-transactions/', query);
  }

  /** GET /api/private/wallet/all-transactions/{id}/ */
  async getTransaction(id: number, format: 'json' | 'concise' = 'json'): Promise<DigitalSurgeAllTransaction> {
    return this.get(`/api/private/wallet/all-transactions/${id}/`, { format });
  }

  /** GET /api/private/v2/wallet/{asset}/wallet-transactions/ */
  async listWalletTransactions(
    asset: string,
    params?: { page?: number; pageSize?: number; format?: 'json' | 'concise' }
  ): Promise<DigitalSurgePaginated<DigitalSurgeAllTransaction>> {
    const query: Record<string, string> = {};
    if (params?.page) query.page = String(params.page);
    if (params?.pageSize) query.page_size = String(params.pageSize);
    if (params?.format) query.format = params.format ?? 'json';
    return this.get(`/api/private/v2/wallet/${encodeURIComponent(asset)}/wallet-transactions/`, query);
  }

  /** GET /api/private/v2/wallet/{asset}/wallet-transactions/{id}/ */
  async getWalletTransaction(
    asset: string,
    id: number | string,
    format: 'json' | 'concise' = 'json'
  ): Promise<DigitalSurgeAllTransaction> {
    return this.get(
      `/api/private/v2/wallet/${encodeURIComponent(asset)}/wallet-transactions/${id}/`,
      { format }
    );
  }

  /** GET /api/private/wallet/{asset}/deposit-addresses/ */
  async listDepositAddresses(asset: string): Promise<DigitalSurgePaginated<DigitalSurgeDepositAddress>> {
    return this.get(`/api/private/wallet/${encodeURIComponent(asset)}/deposit-addresses/`);
  }

  /** GET /api/private/balances/ */
  async listBalances(): Promise<DigitalSurgePaginated<DigitalSurgeBalanceRow>> {
    return this.get('/api/private/balances/');
  }
}
