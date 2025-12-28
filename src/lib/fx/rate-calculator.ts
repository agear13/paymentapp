/**
 * Rate Calculator
 * 
 * Utilities for calculating crypto amounts and formatting rates with precision.
 */

import { log } from '@/lib/logger';
import type { Currency, RateCalculation } from './types';
import { getRateProviderFactory } from './rate-provider-factory';
import { getRateCache } from './rate-cache';

const logger = log.child({ domain: 'fx:calculator' });

/**
 * Precision constants
 */
export const PRECISION = {
  CRYPTO: 8, // 8 decimal places for crypto amounts
  FIAT: 2, // 2 decimal places for fiat amounts
  RATE: 8, // 8 decimal places for exchange rates
} as const;

/**
 * Rate calculator service
 */
export class RateCalculator {
  /**
   * Calculate crypto amount needed for a fiat invoice
   * 
   * @example
   * Invoice: 100 AUD
   * Rate: 0.0385 HBAR/AUD (or 25.97 AUD/HBAR)
   * Result: 100 / 25.97 = 3.85398076 HBAR
   */
  async calculateCryptoAmount(
    fiatAmount: number,
    fiatCurrency: Currency,
    cryptoCurrency: Currency
  ): Promise<RateCalculation> {
    logger.debug(
      { fiatAmount, fiatCurrency, cryptoCurrency },
      'Calculating crypto amount'
    );

    // Get exchange rate (crypto/fiat)
    const rate = await this.getRate(cryptoCurrency, fiatCurrency);

    // Calculate crypto amount
    // If rate is HBAR/AUD = 25.97, then HBAR needed = fiatAmount / rate
    const cryptoAmount = fiatAmount / rate.rate;

    // Round to 8 decimal places
    const roundedCryptoAmount = this.roundToPrecision(
      cryptoAmount,
      PRECISION.CRYPTO
    );

    const result: RateCalculation = {
      sourceCurrency: fiatCurrency,
      targetCurrency: cryptoCurrency,
      sourceAmount: fiatAmount,
      targetAmount: roundedCryptoAmount,
      rate: rate.rate,
      provider: rate.provider,
      timestamp: rate.timestamp,
    };

    logger.debug({ result }, 'Crypto amount calculated');

    return result;
  }

  /**
   * Calculate fiat amount from crypto amount
   * 
   * @example
   * Crypto: 10 HBAR
   * Rate: 25.97 AUD/HBAR
   * Result: 10 * 25.97 = 259.70 AUD
   */
  async calculateFiatAmount(
    cryptoAmount: number,
    cryptoCurrency: Currency,
    fiatCurrency: Currency
  ): Promise<RateCalculation> {
    logger.debug(
      { cryptoAmount, cryptoCurrency, fiatCurrency },
      'Calculating fiat amount'
    );

    // Get exchange rate (crypto/fiat)
    const rate = await this.getRate(cryptoCurrency, fiatCurrency);

    // Calculate fiat amount
    const fiatAmount = cryptoAmount * rate.rate;

    // Round to 2 decimal places for fiat
    const roundedFiatAmount = this.roundToPrecision(
      fiatAmount,
      PRECISION.FIAT
    );

    const result: RateCalculation = {
      sourceCurrency: cryptoCurrency,
      targetCurrency: fiatCurrency,
      sourceAmount: cryptoAmount,
      targetAmount: roundedFiatAmount,
      rate: rate.rate,
      provider: rate.provider,
      timestamp: rate.timestamp,
    };

    logger.debug({ result }, 'Fiat amount calculated');

    return result;
  }

  /**
   * Validate payment amount with tolerance
   * 
   * Check if received amount is within acceptable tolerance of required amount.
   * Default tolerance: 0.5% (as per PRD)
   */
  validatePaymentAmount(
    required: number,
    received: number,
    tolerancePercent = 0.5
  ): {
    isValid: boolean;
    isUnderpayment: boolean;
    isOverpayment: boolean;
    difference: number;
    differencePercent: number;
    withinTolerance: boolean;
  } {
    const difference = received - required;
    const differencePercent = (difference / required) * 100;
    const withinTolerance = Math.abs(differencePercent) <= tolerancePercent;

    const isUnderpayment = difference < -tolerancePercent;
    const isOverpayment = difference > tolerancePercent;

    // Payment is valid if it's >= required OR within tolerance
    const isValid = received >= required * (1 - tolerancePercent / 100);

    return {
      isValid,
      isUnderpayment,
      isOverpayment,
      difference,
      differencePercent,
      withinTolerance,
    };
  }

  /**
   * Compare two rates and calculate variance
   */
  compareRates(
    rate1: number,
    rate2: number
  ): {
    difference: number;
    differencePercent: number;
    isSignificant: boolean; // > 1% variance
  } {
    const difference = rate2 - rate1;
    const differencePercent = (difference / rate1) * 100;
    const isSignificant = Math.abs(differencePercent) > 1;

    return {
      difference,
      differencePercent,
      isSignificant,
    };
  }

  /**
   * Format amount with appropriate precision
   */
  formatAmount(amount: number, currency: Currency): string {
    const isCrypto = ['HBAR', 'USDC', 'BTC', 'ETH'].includes(currency);
    const precision = isCrypto ? PRECISION.CRYPTO : PRECISION.FIAT;

    return amount.toFixed(precision);
  }

  /**
   * Format rate with 8 decimal precision
   */
  formatRate(rate: number): string {
    return rate.toFixed(PRECISION.RATE);
  }

  /**
   * Round number to specific precision
   */
  roundToPrecision(value: number, precision: number): number {
    const multiplier = Math.pow(10, precision);
    return Math.round(value * multiplier) / multiplier;
  }

  /**
   * Get exchange rate with caching
   */
  private async getRate(base: Currency, quote: Currency) {
    // Try cache first
    const cache = getRateCache();
    const cachedRate = cache.get(base, quote);

    if (cachedRate) {
      logger.debug({ base, quote }, 'Using cached rate for calculation');
      return cachedRate;
    }

    // Fetch from provider
    const factory = getRateProviderFactory();
    const rate = await factory.getRate(base, quote);

    // Cache the rate
    cache.set(rate);

    return rate;
  }

  /**
   * Parse amount string to number with validation
   */
  parseAmount(amountStr: string): number {
    const amount = parseFloat(amountStr);

    if (isNaN(amount)) {
      throw new Error(`Invalid amount: ${amountStr}`);
    }

    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }

    return amount;
  }

  /**
   * Convert between crypto currencies using cross rates
   * 
   * @example
   * Convert 10 HBAR to USDC:
   * 1. Get HBAR/USD rate = 0.05
   * 2. Get USDC/USD rate = 1.0
   * 3. USDC = HBAR * (HBAR/USD) / (USDC/USD) = 10 * 0.05 / 1.0 = 0.5 USDC
   */
  async convertCrypto(
    amount: number,
    fromCurrency: Currency,
    toCurrency: Currency
  ): Promise<RateCalculation> {
    logger.debug(
      { amount, fromCurrency, toCurrency },
      'Converting between crypto currencies'
    );

    // Get rates to common fiat (USD)
    const factory = getRateProviderFactory();
    const fromRate = await factory.getRate(fromCurrency, 'USD');
    const toRate = await factory.getRate(toCurrency, 'USD');

    // Calculate cross rate
    const crossRate = fromRate.rate / toRate.rate;

    // Calculate target amount
    const targetAmount = amount * crossRate;

    return {
      sourceCurrency: fromCurrency,
      targetCurrency: toCurrency,
      sourceAmount: amount,
      targetAmount: this.roundToPrecision(targetAmount, PRECISION.CRYPTO),
      rate: crossRate,
      provider: `${fromRate.provider}/${toRate.provider}`,
      timestamp: new Date(),
    };
  }
}

/**
 * Singleton instance
 */
let calculatorInstance: RateCalculator | null = null;

/**
 * Get rate calculator singleton
 */
export const getRateCalculator = (): RateCalculator => {
  if (!calculatorInstance) {
    calculatorInstance = new RateCalculator();
  }
  return calculatorInstance;
};

/**
 * Convenience functions
 */

/**
 * Calculate crypto amount for fiat invoice
 */
export const calculateCryptoForFiat = async (
  fiatAmount: number,
  fiatCurrency: Currency,
  cryptoCurrency: Currency
): Promise<RateCalculation> => {
  const calculator = getRateCalculator();
  return calculator.calculateCryptoAmount(fiatAmount, fiatCurrency, cryptoCurrency);
};

/**
 * Calculate fiat equivalent of crypto amount
 */
export const calculateFiatForCrypto = async (
  cryptoAmount: number,
  cryptoCurrency: Currency,
  fiatCurrency: Currency
): Promise<RateCalculation> => {
  const calculator = getRateCalculator();
  return calculator.calculateFiatAmount(cryptoAmount, cryptoCurrency, fiatCurrency);
};

/**
 * Format amount with appropriate currency precision
 */
export const formatCurrencyAmount = (amount: number, currency: Currency): string => {
  const calculator = getRateCalculator();
  return calculator.formatAmount(amount, currency);
};

/**
 * Format exchange rate with 8 decimal precision
 */
export const formatExchangeRate = (rate: number): string => {
  const calculator = getRateCalculator();
  return calculator.formatRate(rate);
};













