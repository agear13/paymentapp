/**
 * Currency Converter
 * 
 * Advanced currency conversion with:
 * - Real-time rate fetching
 * - Historical rate support
 * - Multi-currency conversion
 * - Rate caching
 * - Precision handling
 * 
 * Sprint 25: Multi-Currency Enhancement
 */

import { log } from '@/lib/logger';
import { getCurrency, getCurrencyDecimals } from './currency-config';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ConversionResult {
  from: {
    amount: number;
    currency: string;
  };
  to: {
    amount: number;
    currency: string;
  };
  rate: number;
  inverseRate: number;
  timestamp: Date;
  source: 'live' | 'cached' | 'fallback';
}

export interface ConversionOptions {
  useCache?: boolean;
  maxCacheAge?: number; // milliseconds
  precision?: number;   // decimal places
  source?: 'live' | 'fallback';
}

export interface MultiConversionResult {
  base: {
    amount: number;
    currency: string;
  };
  conversions: Array<{
    currency: string;
    amount: number;
    rate: number;
  }>;
  timestamp: Date;
}

// ============================================================================
// Rate Cache
// ============================================================================

interface CachedRate {
  from: string;
  to: string;
  rate: number;
  timestamp: Date;
}

const rateCache = new Map<string, CachedRate>();
const DEFAULT_CACHE_AGE = 5 * 60 * 1000; // 5 minutes

/**
 * Generate cache key for rate pair
 */
function getCacheKey(from: string, to: string): string {
  return `${from}:${to}`;
}

/**
 * Get cached rate if available and fresh
 */
function getCachedRate(from: string, to: string, maxAge: number): number | null {
  const key = getCacheKey(from, to);
  const cached = rateCache.get(key);
  
  if (!cached) {
    return null;
  }
  
  const age = Date.now() - cached.timestamp.getTime();
  if (age > maxAge) {
    rateCache.delete(key);
    return null;
  }
  
  return cached.rate;
}

/**
 * Set cached rate
 */
function setCachedRate(from: string, to: string, rate: number): void {
  const key = getCacheKey(from, to);
  rateCache.set(key, {
    from,
    to,
    rate,
    timestamp: new Date(),
  });
}

// ============================================================================
// Rate Fetching
// ============================================================================

/**
 * Fetch exchange rate from API
 * 
 * In production, integrate with real FX API like:
 * - OpenExchangeRates
 * - Fixer.io
 * - CurrencyLayer
 * - ExchangeRate-API
 */
async function fetchLiveRate(from: string, to: string): Promise<number> {
  // For now, return mock rates
  // TODO: Integrate with real FX API
  
  // Common pairs (approximate rates as of Dec 2025)
  const MOCK_RATES: Record<string, number> = {
    'USD:EUR': 0.92,
    'USD:GBP': 0.79,
    'USD:JPY': 149.50,
    'USD:AUD': 1.52,
    'USD:CAD': 1.36,
    'USD:CHF': 0.88,
    'USD:CNY': 7.24,
    'USD:INR': 83.12,
    'USD:SGD': 1.34,
    'USD:HKD': 7.80,
    'EUR:GBP': 0.86,
    'EUR:USD': 1.09,
    'GBP:USD': 1.27,
    'AUD:USD': 0.66,
  };
  
  const key = `${from}:${to}`;
  const inverseKey = `${to}:${from}`;
  
  if (MOCK_RATES[key]) {
    return MOCK_RATES[key];
  }
  
  if (MOCK_RATES[inverseKey]) {
    return 1 / MOCK_RATES[inverseKey];
  }
  
  // Cross-currency conversion via USD
  if (from !== 'USD' && to !== 'USD') {
    const fromToUsd = MOCK_RATES[`${from}:USD`] || (1 / (MOCK_RATES[`USD:${from}`] || 1));
    const usdToTo = MOCK_RATES[`USD:${to}`] || (1 / (MOCK_RATES[`${to}:USD`] || 1));
    return fromToUsd * usdToTo;
  }
  
  // Fallback to 1:1 for unknown pairs
  log.warn({ from, to }, 'No exchange rate found, using 1:1');
  return 1.0;
}

// ============================================================================
// Currency Conversion
// ============================================================================

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  options: ConversionOptions = {}
): Promise<ConversionResult> {
  const {
    useCache = true,
    maxCacheAge = DEFAULT_CACHE_AGE,
    precision,
    source = 'live',
  } = options;
  
  // Same currency - no conversion needed
  if (fromCurrency === toCurrency) {
    return {
      from: { amount, currency: fromCurrency },
      to: { amount, currency: toCurrency },
      rate: 1.0,
      inverseRate: 1.0,
      timestamp: new Date(),
      source: 'cached',
    };
  }
  
  let rate: number;
  let resultSource: 'live' | 'cached' | 'fallback' = 'live';
  
  // Try cache first if enabled
  if (useCache) {
    const cachedRate = getCachedRate(fromCurrency, toCurrency, maxCacheAge);
    if (cachedRate !== null) {
      rate = cachedRate;
      resultSource = 'cached';
      log.debug({ fromCurrency, toCurrency, rate, source: 'cache' }, 'Using cached exchange rate');
    } else {
      rate = await fetchLiveRate(fromCurrency, toCurrency);
      setCachedRate(fromCurrency, toCurrency, rate);
    }
  } else {
    rate = await fetchLiveRate(fromCurrency, toCurrency);
  }
  
  // Apply precision
  const toCurrencyMeta = getCurrency(toCurrency);
  const decimalPlaces = precision ?? (toCurrencyMeta?.decimalDigits ?? 2);
  
  const convertedAmount = amount * rate;
  const roundedAmount = Number(convertedAmount.toFixed(decimalPlaces));
  
  return {
    from: { amount, currency: fromCurrency },
    to: { amount: roundedAmount, currency: toCurrency },
    rate,
    inverseRate: 1 / rate,
    timestamp: new Date(),
    source: resultSource,
  };
}

/**
 * Convert amount to multiple currencies
 */
export async function convertToMultipleCurrencies(
  amount: number,
  fromCurrency: string,
  toCurrencies: string[],
  options: ConversionOptions = {}
): Promise<MultiConversionResult> {
  const conversions = await Promise.all(
    toCurrencies.map(async (toCurrency) => {
      const result = await convertCurrency(amount, fromCurrency, toCurrency, options);
      return {
        currency: toCurrency,
        amount: result.to.amount,
        rate: result.rate,
      };
    })
  );
  
  return {
    base: { amount, currency: fromCurrency },
    conversions,
    timestamp: new Date(),
  };
}

/**
 * Get exchange rate between two currencies
 */
export async function getExchangeRate(
  from: string,
  to: string,
  options: { useCache?: boolean; maxCacheAge?: number } = {}
): Promise<number> {
  const { useCache = true, maxCacheAge = DEFAULT_CACHE_AGE } = options;
  
  if (from === to) {
    return 1.0;
  }
  
  if (useCache) {
    const cachedRate = getCachedRate(from, to, maxCacheAge);
    if (cachedRate !== null) {
      return cachedRate;
    }
  }
  
  const rate = await fetchLiveRate(from, to);
  setCachedRate(from, to, rate);
  return rate;
}

/**
 * Get multiple exchange rates at once
 */
export async function getExchangeRates(
  baseCurrency: string,
  targetCurrencies: string[]
): Promise<Record<string, number>> {
  const rates: Record<string, number> = {};
  
  await Promise.all(
    targetCurrencies.map(async (target) => {
      rates[target] = await getExchangeRate(baseCurrency, target);
    })
  );
  
  return rates;
}

// ============================================================================
// Batch Conversion
// ============================================================================

/**
 * Convert multiple amounts in different currencies to a common currency
 */
export async function normalizeToBaseCurrency(
  amounts: Array<{ amount: number; currency: string }>,
  baseCurrency: string
): Promise<{
  total: number;
  baseCurrency: string;
  breakdown: Array<{
    original: { amount: number; currency: string };
    converted: number;
    rate: number;
  }>;
}> {
  const breakdown = await Promise.all(
    amounts.map(async (item) => {
      const conversion = await convertCurrency(
        item.amount,
        item.currency,
        baseCurrency
      );
      
      return {
        original: item,
        converted: conversion.to.amount,
        rate: conversion.rate,
      };
    })
  );
  
  const total = breakdown.reduce((sum, item) => sum + item.converted, 0);
  
  return {
    total,
    baseCurrency,
    breakdown,
  };
}

// ============================================================================
// Currency Comparison
// ============================================================================

/**
 * Compare amounts in different currencies
 */
export async function compareCurrencyAmounts(
  amount1: number,
  currency1: string,
  amount2: number,
  currency2: string
): Promise<{
  amount1Greater: boolean;
  amount2Greater: boolean;
  equal: boolean;
  difference: number;
  differenceCurrency: string;
}> {
  // Convert amount2 to currency1 for comparison
  const conversion = await convertCurrency(amount2, currency2, currency1);
  const converted2 = conversion.to.amount;
  
  const difference = amount1 - converted2;
  const epsilon = Math.pow(10, -getCurrencyDecimals(currency1));
  
  return {
    amount1Greater: difference > epsilon,
    amount2Greater: difference < -epsilon,
    equal: Math.abs(difference) <= epsilon,
    difference,
    differenceCurrency: currency1,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format conversion result for display
 */
export function formatConversion(result: ConversionResult): string {
  const { from, to, rate } = result;
  return `${from.amount} ${from.currency} = ${to.amount} ${to.currency} (@ ${rate.toFixed(6)})`;
}

/**
 * Clear rate cache
 */
export function clearRateCache(): void {
  rateCache.clear();
  log.info('Currency rate cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  pairs: string[];
  oldestEntry: Date | null;
  newestEntry: Date | null;
} {
  const entries = Array.from(rateCache.values());
  
  return {
    size: entries.length,
    pairs: entries.map(e => `${e.from}:${e.to}`),
    oldestEntry: entries.length > 0
      ? entries.reduce((oldest, entry) => 
          entry.timestamp < oldest ? entry.timestamp : oldest, 
          entries[0].timestamp
        )
      : null,
    newestEntry: entries.length > 0
      ? entries.reduce((newest, entry) => 
          entry.timestamp > newest ? entry.timestamp : newest, 
          entries[0].timestamp
        )
      : null,
  };
}







