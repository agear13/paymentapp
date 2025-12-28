/**
 * CoinGecko Rate Provider
 * 
 * Primary rate provider using CoinGecko API.
 * API Docs: https://docs.coingecko.com/reference/introduction
 */

import { log } from '@/lib/logger';
import type { Currency, CurrencyPair, ExchangeRate, RateProviderConfig } from '../types';
import { IRateProvider, RateProviderError } from '../rate-provider.interface';

const logger = log.child({ domain: 'fx:coingecko' });

/**
 * CoinGecko API configuration
 */
interface CoinGeckoConfig extends RateProviderConfig {
  apiKey?: string; // Optional Pro API key
  baseUrl?: string;
}

/**
 * CoinGecko API response format
 */
interface CoinGeckoSimplePriceResponse {
  [coinId: string]: {
    [currency: string]: number;
  };
}

/**
 * Currency code to CoinGecko ID mapping
 */
const CURRENCY_TO_COINGECKO_ID: Record<string, string> = {
  HBAR: 'hedera-hashgraph',
  USDC: 'usd-coin',
  USDT: 'tether',
  AUDD: 'australian-digital-dollar', // Note: May not exist on CoinGecko yet
  BTC: 'bitcoin',
  ETH: 'ethereum',
};

/**
 * Supported fiat currencies on CoinGecko
 */
const SUPPORTED_FIAT: Set<string> = new Set([
  'USD', 'AUD', 'EUR', 'GBP', 'CAD', 'NZD', 'SGD', 'JPY', 'CNY', 'INR'
]);

/**
 * CoinGecko rate provider implementation
 */
export class CoinGeckoProvider implements IRateProvider {
  readonly name = 'coingecko';
  readonly priority = 1; // Primary provider (lower = higher priority)

  private config?: CoinGeckoConfig;
  private baseUrl = 'https://api.coingecko.com/api/v3';

  /**
   * Initialize the provider
   */
  async initialize(config: RateProviderConfig): Promise<void> {
    this.config = config as CoinGeckoConfig;
    
    if (this.config.baseUrl) {
      this.baseUrl = this.config.baseUrl;
    }

    // If Pro API key is provided, use Pro endpoint
    if (this.config.apiKey) {
      this.baseUrl = 'https://pro-api.coingecko.com/api/v3';
    }

    logger.info({ provider: this.name }, 'CoinGecko provider initialized');
  }

  /**
   * Fetch single exchange rate
   */
  async getRate(base: Currency, quote: Currency): Promise<ExchangeRate> {
    const rates = await this.getRates([{ base, quote }]);
    return rates[0];
  }

  /**
   * Fetch multiple exchange rates efficiently
   */
  async getRates(pairs: CurrencyPair[]): Promise<ExchangeRate[]> {
    logger.debug({ pairs }, 'Fetching rates from CoinGecko');

    // Validate all pairs are supported
    for (const pair of pairs) {
      if (!this.supportsPair(pair.base, pair.quote)) {
        throw new RateProviderError(
          `Unsupported currency pair: ${pair.base}/${pair.quote}`,
          this.name,
          'UNSUPPORTED_PAIR'
        );
      }
    }

    // Group pairs by base currency for efficient API calls
    const coinIds = new Set<string>();
    const vsCurrencies = new Set<string>();

    for (const pair of pairs) {
      const coinId = CURRENCY_TO_COINGECKO_ID[pair.base];
      if (coinId) {
        coinIds.add(coinId);
        vsCurrencies.add(pair.quote.toLowerCase());
      }
    }

    // Build API request
    const url = new URL(`${this.baseUrl}/simple/price`);
    url.searchParams.set('ids', Array.from(coinIds).join(','));
    url.searchParams.set('vs_currencies', Array.from(vsCurrencies).join(','));
    url.searchParams.set('precision', '8'); // 8 decimal places

    const headers: HeadersInit = {
      'Accept': 'application/json',
    };

    // Add API key if available
    if (this.config?.apiKey) {
      headers['x-cg-pro-api-key'] = this.config.apiKey;
    }

    try {
      logger.debug({ url: url.toString() }, 'Making CoinGecko API request');

      const response = await fetch(url.toString(), {
        headers,
        signal: AbortSignal.timeout(this.config?.timeout || 10000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new RateProviderError(
          `CoinGecko API error: ${response.status} ${response.statusText}`,
          this.name,
          'API_ERROR',
          response.status,
          new Error(errorText)
        );
      }

      const data = await response.json() as CoinGeckoSimplePriceResponse;

      logger.debug({ data }, 'Received CoinGecko response');

      // Transform response to ExchangeRate format
      const timestamp = new Date();
      const rates: ExchangeRate[] = [];

      for (const pair of pairs) {
        const coinId = CURRENCY_TO_COINGECKO_ID[pair.base];
        const quoteLower = pair.quote.toLowerCase();

        if (!coinId || !data[coinId] || data[coinId][quoteLower] === undefined) {
          logger.warn({ pair }, 'Rate not found in CoinGecko response');
          throw new RateProviderError(
            `Rate not available for ${pair.base}/${pair.quote}`,
            this.name,
            'RATE_NOT_FOUND'
          );
        }

        const rate = data[coinId][quoteLower];

        rates.push({
          base: pair.base,
          quote: pair.quote,
          rate,
          provider: this.name,
          timestamp,
          metadata: {
            coinId,
            source: 'coingecko_simple_price',
          },
        });
      }

      logger.info({ count: rates.length }, 'Successfully fetched rates from CoinGecko');

      return rates;
    } catch (error) {
      if (error instanceof RateProviderError) {
        throw error;
      }

      logger.error({ error, pairs }, 'Failed to fetch rates from CoinGecko');

      throw new RateProviderError(
        `Failed to fetch rates: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.name,
        'FETCH_ERROR',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if provider supports a currency pair
   */
  supportsPair(base: Currency, quote: Currency): boolean {
    // Check if base currency is a supported crypto
    const hasCoinId = CURRENCY_TO_COINGECKO_ID[base] !== undefined;
    
    // Check if quote currency is a supported fiat
    const isFiatSupported = SUPPORTED_FIAT.has(quote);

    return hasCoinId && isFiatSupported;
  }

  /**
   * Check if provider is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/ping`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      logger.warn({ error }, 'CoinGecko availability check failed');
      return false;
    }
  }

  /**
   * Get provider metadata
   */
  getMetadata() {
    return {
      name: this.name,
      priority: this.priority,
      supportedPairs: this.getSupportedPairs(),
      rateLimit: {
        requestsPerMinute: this.config?.apiKey ? 500 : 50,
        requestsPerDay: this.config?.apiKey ? undefined : 10000,
      },
    };
  }

  /**
   * Get all supported currency pairs
   */
  private getSupportedPairs(): CurrencyPair[] {
    const pairs: CurrencyPair[] = [];
    const cryptos = Object.keys(CURRENCY_TO_COINGECKO_ID) as Currency[];
    const fiats = Array.from(SUPPORTED_FIAT) as Currency[];

    for (const base of cryptos) {
      for (const quote of fiats) {
        pairs.push({ base, quote });
      }
    }

    return pairs;
  }
}


