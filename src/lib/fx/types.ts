/**
 * FX Pricing Engine Types
 * 
 * Type definitions for the FX rate fetching and snapshot system.
 */

/**
 * Currency codes supported for rate fetching
 */
export type CryptoCurrency = 'HBAR' | 'USDC' | 'USDT' | 'AUDD';
export type FiatCurrency = 'USD' | 'AUD' | 'EUR' | 'GBP' | 'CAD' | 'NZD' | 'SGD';
export type Currency = CryptoCurrency | FiatCurrency;

/**
 * Currency pair for exchange rate
 */
export interface CurrencyPair {
  base: Currency;
  quote: Currency;
}

/**
 * Exchange rate with metadata
 */
export interface ExchangeRate {
  base: Currency;
  quote: Currency;
  rate: number; // Rate as number (8 decimal precision)
  provider: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Rate provider response
 */
export interface RateProviderResponse {
  rates: ExchangeRate[];
  provider: string;
  timestamp: Date;
}

/**
 * Rate provider configuration
 */
export interface RateProviderConfig {
  name: string;
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
}

/**
 * Rate cache entry
 */
export interface RateCacheEntry {
  rate: ExchangeRate;
  expiresAt: Date;
}

/**
 * FX snapshot data for database storage
 */
export interface FxSnapshotData {
  paymentLinkId: string;
  snapshotType: 'CREATION' | 'SETTLEMENT';
  tokenType?: CryptoCurrency;
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  provider: string;
  capturedAt?: Date;
}

/**
 * Rate calculation result
 */
export interface RateCalculation {
  sourceCurrency: Currency;
  targetCurrency: Currency;
  sourceAmount: number;
  targetAmount: number;
  rate: number;
  provider: string;
  timestamp: Date;
}

/**
 * Rate validation result
 */
export interface RateValidation {
  isValid: boolean;
  rate?: number;
  errors?: string[];
  warnings?: string[];
}


