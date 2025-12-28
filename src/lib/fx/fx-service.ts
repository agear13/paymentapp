/**
 * FX Service
 * 
 * High-level service that orchestrates all FX pricing engine components.
 * This is the main interface for the application to interact with FX functionality.
 */

import { log } from '@/lib/logger';
import type { FxSnapshot } from '@prisma/client';
import type { Currency, ExchangeRate, RateCalculation } from './types';
import { getRateProviderFactory, initializeRateProviders } from './rate-provider-factory';
import { getRateCache } from './rate-cache';
import { getFxSnapshotService } from './fx-snapshot-service';
import { getRateCalculator } from './rate-calculator';

const logger = log.child({ domain: 'fx:service' });

/**
 * Main FX Service
 * 
 * Provides a unified interface for all FX operations
 */
export class FxService {
  private initialized = false;

  /**
   * Initialize the FX service and all providers
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing FX service');

    try {
      // Initialize rate providers
      await initializeRateProviders();

      this.initialized = true;

      logger.info('FX service initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize FX service');
      throw error;
    }
  }

  /**
   * Get current exchange rate
   */
  async getRate(base: Currency, quote: Currency): Promise<ExchangeRate> {
    await this.ensureInitialized();

    const factory = getRateProviderFactory();
    return factory.getRate(base, quote);
  }

  /**
   * Get multiple exchange rates
   */
  async getRates(pairs: { base: Currency; quote: Currency }[]): Promise<ExchangeRate[]> {
    await this.ensureInitialized();

    const factory = getRateProviderFactory();
    return factory.getRates(pairs);
  }

  /**
   * Calculate crypto amount for fiat invoice
   */
  async calculateCryptoAmount(
    fiatAmount: number,
    fiatCurrency: Currency,
    cryptoCurrency: Currency
  ): Promise<RateCalculation> {
    await this.ensureInitialized();

    const calculator = getRateCalculator();
    return calculator.calculateCryptoAmount(fiatAmount, fiatCurrency, cryptoCurrency);
  }

  /**
   * Calculate fiat value of crypto amount
   */
  async calculateFiatAmount(
    cryptoAmount: number,
    cryptoCurrency: Currency,
    fiatCurrency: Currency
  ): Promise<RateCalculation> {
    await this.ensureInitialized();

    const calculator = getRateCalculator();
    return calculator.calculateFiatAmount(cryptoAmount, cryptoCurrency, fiatCurrency);
  }

  /**
   * Validate payment amount with tolerance
   */
  validatePaymentAmount(
    required: number,
    received: number,
    tolerancePercent = 0.5
  ) {
    const calculator = getRateCalculator();
    return calculator.validatePaymentAmount(required, received, tolerancePercent);
  }

  /**
   * Capture creation-time snapshot (single token)
   */
  async captureCreationSnapshot(
    paymentLinkId: string,
    baseCurrency: Currency,
    quoteCurrency: Currency,
    tokenType?: Currency
  ): Promise<FxSnapshot> {
    await this.ensureInitialized();

    const snapshotService = getFxSnapshotService();
    return snapshotService.captureCreationSnapshot(
      paymentLinkId,
      baseCurrency,
      quoteCurrency,
      tokenType
    );
  }

  /**
   * Capture creation-time snapshots for all tokens (HBAR, USDC, USDT)
   */
  async captureAllCreationSnapshots(
    paymentLinkId: string,
    quoteCurrency: Currency
  ): Promise<FxSnapshot[]> {
    await this.ensureInitialized();

    const snapshotService = getFxSnapshotService();
    return snapshotService.captureAllCreationSnapshots(
      paymentLinkId,
      quoteCurrency
    );
  }

  /**
   * Capture settlement-time snapshot (single token)
   */
  async captureSettlementSnapshot(
    paymentLinkId: string,
    baseCurrency: Currency,
    quoteCurrency: Currency,
    tokenType?: Currency
  ): Promise<FxSnapshot> {
    await this.ensureInitialized();

    const snapshotService = getFxSnapshotService();
    return snapshotService.captureSettlementSnapshot(
      paymentLinkId,
      baseCurrency,
      quoteCurrency,
      tokenType
    );
  }

  /**
   * Get snapshots for a payment link
   */
  async getSnapshots(paymentLinkId: string): Promise<FxSnapshot[]> {
    const snapshotService = getFxSnapshotService();
    return snapshotService.getSnapshots(paymentLinkId);
  }

  /**
   * Calculate rate variance between creation and settlement
   */
  async calculateRateVariance(paymentLinkId: string) {
    const snapshotService = getFxSnapshotService();
    return snapshotService.calculateRateVariance(paymentLinkId);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const cache = getRateCache();
    return cache.getStats();
  }

  /**
   * Clear rate cache
   */
  clearCache(): void {
    const cache = getRateCache();
    cache.clear();
  }

  /**
   * Check health of all rate providers
   */
  async checkProviderHealth() {
    await this.ensureInitialized();

    const factory = getRateProviderFactory();
    return factory.checkHealth();
  }

  /**
   * Get metadata for all providers
   */
  async getProviderMetadata() {
    await this.ensureInitialized();

    const factory = getRateProviderFactory();
    return factory.getMetadata();
  }

  /**
   * Format amount with currency precision
   */
  formatAmount(amount: number, currency: Currency): string {
    const calculator = getRateCalculator();
    return calculator.formatAmount(amount, currency);
  }

  /**
   * Format rate with 8 decimal precision
   */
  formatRate(rate: number): string {
    const calculator = getRateCalculator();
    return calculator.formatRate(rate);
  }

  /**
   * Ensure service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

/**
 * Singleton instance
 */
let serviceInstance: FxService | null = null;

/**
 * Get FX service singleton
 */
export const getFxService = (): FxService => {
  if (!serviceInstance) {
    serviceInstance = new FxService();
  }
  return serviceInstance;
};


