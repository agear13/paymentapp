/**
 * FX Pricing Engine
 * 
 * Main entry point for the FX pricing engine.
 * Exports all services, utilities, and types.
 */

// Types
export type {
  Currency,
  CryptoCurrency,
  FiatCurrency,
  CurrencyPair,
  ExchangeRate,
  RateProviderResponse,
  RateProviderConfig,
  RateCacheEntry,
  FxSnapshotData,
  RateCalculation,
  RateValidation,
} from './types';

// Rate Providers
export type { IRateProvider } from './rate-provider.interface';
export { RateProviderError } from './rate-provider.interface';
export { CoinGeckoProvider } from './providers/coingecko';
export { HederaMirrorProvider } from './providers/hedera-mirror';

// Provider Factory
export {
  RateProviderFactory,
  getRateProviderFactory,
  initializeRateProviders,
} from './rate-provider-factory';

// Rate Cache
export { RateCache, getRateCache } from './rate-cache';

// FX Snapshot Service
export {
  FxSnapshotService,
  getFxSnapshotService,
} from './fx-snapshot-service';

// Rate Calculator
export {
  RateCalculator,
  getRateCalculator,
  PRECISION,
  calculateCryptoForFiat,
  calculateFiatForCrypto,
  formatCurrencyAmount,
  formatExchangeRate,
} from './rate-calculator';

// Main FX Service (convenience wrapper)
export { FxService, getFxService } from './fx-service';













