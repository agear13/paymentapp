/**
 * Rate Provider Factory
 * 
 * Factory for creating and managing rate providers with automatic fallback.
 */

import { log } from '@/lib/logger';
import type { Currency, CurrencyPair, ExchangeRate, RateProviderConfig } from './types';
import { IRateProvider, RateProviderError } from './rate-provider.interface';
import { CoinGeckoProvider } from './providers/coingecko';
import { HederaMirrorProvider } from './providers/hedera-mirror';

const logger = log.child({ domain: 'fx:factory' });

/**
 * Provider factory configuration
 */
interface ProviderFactoryConfig {
  providers?: {
    coingecko?: RateProviderConfig;
    hederaMirror?: RateProviderConfig;
  };
  fallbackEnabled?: boolean;
  maxRetries?: number;
}

/**
 * Rate provider factory with automatic fallback
 */
export class RateProviderFactory {
  private providers: IRateProvider[] = [];
  private initialized = false;
  private config: ProviderFactoryConfig;

  constructor(config: ProviderFactoryConfig = {}) {
    this.config = {
      fallbackEnabled: true,
      maxRetries: 2,
      ...config,
    };
  }

  /**
   * Initialize all providers
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing rate providers');

    // Initialize CoinGecko (primary)
    const coinGeckoConfig: RateProviderConfig = {
      name: 'coingecko',
      apiKey: process.env.COINGECKO_API_KEY,
      timeout: 10000,
      retries: 2,
      ...this.config.providers?.coingecko,
    };

    const coinGecko = new CoinGeckoProvider();
    await coinGecko.initialize(coinGeckoConfig);
    this.providers.push(coinGecko);

    // Initialize Hedera Mirror Node (fallback)
    const hederaMirrorConfig: RateProviderConfig = {
      name: 'hedera_mirror',
      timeout: 10000,
      retries: 2,
      ...this.config.providers?.hederaMirror,
    };

    const hederaMirror = new HederaMirrorProvider();
    await hederaMirror.initialize(hederaMirrorConfig);
    this.providers.push(hederaMirror);

    // Sort providers by priority
    this.providers.sort((a, b) => a.priority - b.priority);

    this.initialized = true;

    logger.info(
      { providers: this.providers.map(p => p.name) },
      'Rate providers initialized'
    );
  }

  /**
   * Get exchange rate with automatic fallback
   */
  async getRate(base: Currency, quote: Currency): Promise<ExchangeRate> {
    return this.getRateWithFallback({ base, quote });
  }

  /**
   * Get multiple exchange rates with automatic fallback
   */
  async getRates(pairs: CurrencyPair[]): Promise<ExchangeRate[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.debug({ pairs }, 'Fetching rates with fallback');

    const errors: Error[] = [];

    // Try each provider in order of priority
    for (const provider of this.providers) {
      // Check if provider supports all requested pairs
      const unsupportedPairs = pairs.filter(
        pair => !provider.supportsPair(pair.base, pair.quote)
      );

      if (unsupportedPairs.length > 0) {
        logger.debug(
          { provider: provider.name, unsupportedPairs },
          'Provider does not support all pairs, skipping'
        );
        continue;
      }

      try {
        logger.debug({ provider: provider.name }, 'Attempting to fetch rates');

        const rates = await provider.getRates(pairs);

        logger.info(
          { provider: provider.name, count: rates.length },
          'Successfully fetched rates'
        );

        return rates;
      } catch (error) {
        logger.warn(
          { provider: provider.name, error },
          'Provider failed, trying next'
        );

        errors.push(error instanceof Error ? error : new Error(String(error)));

        if (!this.config.fallbackEnabled) {
          break;
        }
      }
    }

    // All providers failed
    logger.error({ errors, pairs }, 'All rate providers failed');

    throw new RateProviderError(
      `Failed to fetch rates from all providers. Errors: ${errors.map(e => e.message).join('; ')}`,
      'factory',
      'ALL_PROVIDERS_FAILED'
    );
  }

  /**
   * Get rate with fallback for a single pair
   */
  private async getRateWithFallback(pair: CurrencyPair): Promise<ExchangeRate> {
    const rates = await this.getRates([pair]);
    return rates[0];
  }

  /**
   * Get all available providers
   */
  getProviders(): IRateProvider[] {
    return [...this.providers];
  }

  /**
   * Get provider by name
   */
  getProvider(name: string): IRateProvider | undefined {
    return this.providers.find(p => p.name === name);
  }

  /**
   * Check if any provider supports a pair
   */
  supportsPair(base: Currency, quote: Currency): boolean {
    return this.providers.some(p => p.supportsPair(base, quote));
  }

  /**
   * Get all providers that support a pair
   */
  getProvidersForPair(base: Currency, quote: Currency): IRateProvider[] {
    return this.providers.filter(p => p.supportsPair(base, quote));
  }

  /**
   * Check health of all providers
   */
  async checkHealth(): Promise<Record<string, boolean>> {
    if (!this.initialized) {
      await this.initialize();
    }

    const health: Record<string, boolean> = {};

    await Promise.all(
      this.providers.map(async provider => {
        try {
          health[provider.name] = await provider.isAvailable();
        } catch {
          health[provider.name] = false;
        }
      })
    );

    return health;
  }

  /**
   * Get metadata for all providers
   */
  getMetadata() {
    return this.providers.map(p => p.getMetadata());
  }
}

/**
 * Singleton instance of rate provider factory
 */
let factoryInstance: RateProviderFactory | null = null;

/**
 * Get singleton rate provider factory
 */
export const getRateProviderFactory = (): RateProviderFactory => {
  if (!factoryInstance) {
    factoryInstance = new RateProviderFactory();
  }
  return factoryInstance;
};

/**
 * Initialize the global rate provider factory
 */
export const initializeRateProviders = async (): Promise<void> => {
  const factory = getRateProviderFactory();
  await factory.initialize();
};













