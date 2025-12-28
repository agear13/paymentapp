/**
 * Rate Provider Interface
 * 
 * Abstract interface for FX rate providers (CoinGecko, Hedera Mirror Node, etc.)
 */

import type { Currency, CurrencyPair, ExchangeRate, RateProviderConfig } from './types';

/**
 * Rate provider interface
 * All rate providers must implement this interface
 */
export interface IRateProvider {
  /**
   * Provider name
   */
  readonly name: string;

  /**
   * Provider priority (lower = higher priority)
   */
  readonly priority: number;

  /**
   * Initialize the provider
   */
  initialize(config: RateProviderConfig): Promise<void>;

  /**
   * Fetch exchange rate for a single currency pair
   */
  getRate(base: Currency, quote: Currency): Promise<ExchangeRate>;

  /**
   * Fetch exchange rates for multiple currency pairs
   */
  getRates(pairs: CurrencyPair[]): Promise<ExchangeRate[]>;

  /**
   * Check if provider supports a currency pair
   */
  supportsPair(base: Currency, quote: Currency): boolean;

  /**
   * Check if provider is available/healthy
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get provider metadata
   */
  getMetadata(): {
    name: string;
    priority: number;
    supportedPairs: CurrencyPair[];
    rateLimit?: {
      requestsPerMinute: number;
      requestsPerDay?: number;
    };
  };
}

/**
 * Rate provider error
 */
export class RateProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly code?: string,
    public readonly statusCode?: number,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'RateProviderError';
  }
}













