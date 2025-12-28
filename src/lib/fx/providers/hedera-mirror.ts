/**
 * Hedera Mirror Node Rate Provider
 * 
 * Fallback rate provider using Hedera Mirror Node API.
 * API Docs: https://docs.hedera.com/hedera/sdks-and-apis/rest-api
 */

import { log } from '@/lib/logger';
import type { Currency, CurrencyPair, ExchangeRate, RateProviderConfig } from '../types';
import { IRateProvider, RateProviderError } from '../rate-provider.interface';

const logger = log.child({ domain: 'fx:hedera-mirror' });

/**
 * Hedera Mirror Node configuration
 */
interface HederaMirrorConfig extends RateProviderConfig {
  network?: 'mainnet' | 'testnet';
}

/**
 * Network to Mirror Node URL mapping
 */
const MIRROR_NODE_URLS: Record<string, string> = {
  mainnet: 'https://mainnet-public.mirrornode.hedera.com',
  testnet: 'https://testnet.mirrornode.hedera.com',
};

/**
 * Hedera network exchange rate response
 * Format from /api/v1/network/exchangerate endpoint
 */
interface HederaExchangeRateResponse {
  current_rate: {
    cent_equivalent: number;
    expiration_time: number;
    hbar_equivalent: number;
  };
  next_rate: {
    cent_equivalent: number;
    expiration_time: number;
    hbar_equivalent: number;
  };
  timestamp: string;
}

/**
 * Hedera Mirror Node rate provider implementation
 * 
 * Note: This provider primarily provides HBAR/USD rates from the network's
 * consensus pricing. For other pairs, we may need to combine with static
 * fallback rates or other sources.
 */
export class HederaMirrorProvider implements IRateProvider {
  readonly name = 'hedera_mirror';
  readonly priority = 2; // Fallback provider (higher number = lower priority)

  private config?: HederaMirrorConfig;
  private baseUrl: string;

  constructor() {
    this.baseUrl = MIRROR_NODE_URLS.mainnet;
  }

  /**
   * Initialize the provider
   */
  async initialize(config: RateProviderConfig): Promise<void> {
    this.config = config as HederaMirrorConfig;
    
    // Set base URL based on network
    const network = this.config.network || 'mainnet';
    this.baseUrl = MIRROR_NODE_URLS[network];

    logger.info({ provider: this.name, network }, 'Hedera Mirror provider initialized');
  }

  /**
   * Fetch single exchange rate
   */
  async getRate(base: Currency, quote: Currency): Promise<ExchangeRate> {
    const rates = await this.getRates([{ base, quote }]);
    return rates[0];
  }

  /**
   * Fetch multiple exchange rates
   */
  async getRates(pairs: CurrencyPair[]): Promise<ExchangeRate[]> {
    logger.debug({ pairs }, 'Fetching rates from Hedera Mirror Node');

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

    // Fetch HBAR/USD rate from network
    const hbarUsdRate = await this.fetchHbarUsdRate();

    // Build result for requested pairs
    const rates: ExchangeRate[] = [];
    const timestamp = new Date();

    // Static conversion rates (TODO: Fetch dynamically in production)
    const usdToAud = 1.52; // USD to AUD conversion rate
    const audToUsd = 1 / usdToAud; // AUD to USD conversion rate

    for (const pair of pairs) {
      if (pair.base === 'HBAR' && pair.quote === 'USD') {
        rates.push({
          base: pair.base,
          quote: pair.quote,
          rate: hbarUsdRate,
          provider: this.name,
          timestamp,
          metadata: {
            source: 'hedera_network_consensus',
          },
        });
      } else if (pair.base === 'USDC' && pair.quote === 'USD') {
        // USDC/USD is approximately 1:1
        rates.push({
          base: pair.base,
          quote: pair.quote,
          rate: 1.0,
          provider: this.name,
          timestamp,
          metadata: {
            source: 'static_peg',
            note: 'USDC is pegged to USD at 1:1',
          },
        });
      } else if (pair.base === 'USDT' && pair.quote === 'USD') {
        // USDT/USD is approximately 1:1
        rates.push({
          base: pair.base,
          quote: pair.quote,
          rate: 1.0,
          provider: this.name,
          timestamp,
          metadata: {
            source: 'static_peg',
            note: 'USDT is pegged to USD at 1:1',
          },
        });
      } else if (pair.base === 'AUDD' && pair.quote === 'AUD') {
        // AUDD/AUD is approximately 1:1 (AUDD is pegged to AUD)
        rates.push({
          base: pair.base,
          quote: pair.quote,
          rate: 1.0,
          provider: this.name,
          timestamp,
          metadata: {
            source: 'static_peg',
            note: 'AUDD is pegged to AUD at 1:1',
          },
        });
      } else if (pair.base === 'AUDD' && pair.quote === 'USD') {
        // AUDD/USD = 1 AUD in USD = audToUsd
        rates.push({
          base: pair.base,
          quote: pair.quote,
          rate: audToUsd,
          provider: this.name,
          timestamp,
          metadata: {
            source: 'calculated',
            audUsdRate: audToUsd,
            note: 'Calculated from AUDD peg to AUD and AUD/USD rate',
          },
        });
      } else if (pair.base === 'HBAR' && pair.quote === 'AUD') {
        // Calculate HBAR/AUD using HBAR/USD and USD/AUD rate
        rates.push({
          base: pair.base,
          quote: pair.quote,
          rate: hbarUsdRate * usdToAud,
          provider: this.name,
          timestamp,
          metadata: {
            source: 'calculated',
            hbarUsdRate,
            usdAudRate: usdToAud,
            note: 'Calculated from HBAR/USD and USD/AUD rate',
          },
        });
      } else if (pair.base === 'USDC' && pair.quote === 'AUD') {
        // USDC/AUD = 1 * USD/AUD
        rates.push({
          base: pair.base,
          quote: pair.quote,
          rate: usdToAud,
          provider: this.name,
          timestamp,
          metadata: {
            source: 'calculated',
            usdAudRate: usdToAud,
            note: 'Calculated from USDC peg and USD/AUD rate',
          },
        });
      } else if (pair.base === 'USDT' && pair.quote === 'AUD') {
        // USDT/AUD = 1 * USD/AUD
        rates.push({
          base: pair.base,
          quote: pair.quote,
          rate: usdToAud,
          provider: this.name,
          timestamp,
          metadata: {
            source: 'calculated',
            usdAudRate: usdToAud,
            note: 'Calculated from USDT peg and USD/AUD rate',
          },
        });
      }
    }

    logger.info({ count: rates.length }, 'Successfully fetched rates from Hedera Mirror');

    return rates;
  }

  /**
   * Fetch HBAR/USD rate from Hedera network consensus
   */
  private async fetchHbarUsdRate(): Promise<number> {
    const url = `${this.baseUrl}/api/v1/network/exchangerate`;

    try {
      logger.debug({ url }, 'Fetching HBAR/USD rate from Hedera network');

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(this.config?.timeout || 10000),
      });

      if (!response.ok) {
        throw new RateProviderError(
          `Hedera Mirror API error: ${response.status} ${response.statusText}`,
          this.name,
          'API_ERROR',
          response.status
        );
      }

      const data = await response.json() as HederaExchangeRateResponse;

      // Calculate HBAR/USD rate from network response
      // cent_equivalent / hbar_equivalent gives cents per HBAR
      // Divide by 100 to get USD per HBAR
      const rate = data.current_rate.cent_equivalent / data.current_rate.hbar_equivalent / 100;

      logger.debug({ rate, data: data.current_rate }, 'HBAR/USD rate calculated');

      return rate;
    } catch (error) {
      if (error instanceof RateProviderError) {
        throw error;
      }

      logger.error({ error }, 'Failed to fetch HBAR/USD rate from Hedera Mirror');

      throw new RateProviderError(
        `Failed to fetch HBAR/USD rate: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    // Currently supports:
    // - HBAR/USD (from network)
    // - USDC/USD (static peg)
    // - USDT/USD (static peg)
    // - AUDD/AUD (static peg)
    // - AUDD/USD (calculated)
    // - HBAR/AUD (calculated)
    // - USDC/AUD (calculated)
    // - USDT/AUD (calculated)
    const supportedPairs = [
      'HBAR/USD',
      'USDC/USD',
      'USDT/USD',
      'AUDD/AUD',
      'AUDD/USD',
      'HBAR/AUD',
      'USDC/AUD',
      'USDT/AUD',
    ];

    return supportedPairs.includes(`${base}/${quote}`);
  }

  /**
   * Check if provider is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/api/v1/network/exchangerate`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      logger.warn({ error }, 'Hedera Mirror availability check failed');
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
      supportedPairs: [
        { base: 'HBAR' as Currency, quote: 'USD' as Currency },
        { base: 'USDC' as Currency, quote: 'USD' as Currency },
        { base: 'USDT' as Currency, quote: 'USD' as Currency },
        { base: 'AUDD' as Currency, quote: 'AUD' as Currency },
        { base: 'AUDD' as Currency, quote: 'USD' as Currency },
        { base: 'HBAR' as Currency, quote: 'AUD' as Currency },
        { base: 'USDC' as Currency, quote: 'AUD' as Currency },
        { base: 'USDT' as Currency, quote: 'AUD' as Currency },
      ],
      rateLimit: {
        requestsPerMinute: 100, // Hedera Mirror is generally more permissive
      },
    };
  }
}


