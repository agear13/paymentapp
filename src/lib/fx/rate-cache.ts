/**
 * Rate Cache
 * 
 * In-memory cache for exchange rates to reduce API calls.
 * Cache duration is short-lived (60 seconds) for FX rate accuracy.
 */

import { log } from '@/lib/logger';
import type { Currency, ExchangeRate, RateCacheEntry } from './types';

const logger = log.child({ domain: 'fx:cache' });

/**
 * Rate cache configuration
 */
interface RateCacheConfig {
  ttlMs?: number; // Time to live in milliseconds
  maxEntries?: number; // Maximum cache entries
}

/**
 * Rate cache implementation
 */
export class RateCache {
  private cache = new Map<string, RateCacheEntry>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(config: RateCacheConfig = {}) {
    this.ttlMs = config.ttlMs ?? 60000; // Default 60 seconds
    this.maxEntries = config.maxEntries ?? 1000;

    logger.info({ ttlMs: this.ttlMs, maxEntries: this.maxEntries }, 'Rate cache initialized');
  }

  /**
   * Generate cache key for a currency pair
   */
  private getCacheKey(base: Currency, quote: Currency, provider?: string): string {
    return provider ? `${base}/${quote}:${provider}` : `${base}/${quote}`;
  }

  /**
   * Get rate from cache
   */
  get(base: Currency, quote: Currency, provider?: string): ExchangeRate | null {
    const key = this.getCacheKey(base, quote, provider);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt.getTime()) {
      this.cache.delete(key);
      logger.debug({ base, quote, provider }, 'Cache entry expired');
      return null;
    }

    logger.debug({ base, quote, provider }, 'Cache hit');
    return entry.rate;
  }

  /**
   * Set rate in cache
   */
  set(rate: ExchangeRate): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    const key = this.getCacheKey(rate.base, rate.quote, rate.provider);
    const expiresAt = new Date(Date.now() + this.ttlMs);

    this.cache.set(key, {
      rate,
      expiresAt,
    });

    logger.debug(
      { base: rate.base, quote: rate.quote, provider: rate.provider, expiresAt },
      'Rate cached'
    );
  }

  /**
   * Set multiple rates in cache
   */
  setMany(rates: ExchangeRate[]): void {
    for (const rate of rates) {
      this.set(rate);
    }
  }

  /**
   * Check if rate exists in cache and is not expired
   */
  has(base: Currency, quote: Currency, provider?: string): boolean {
    return this.get(base, quote, provider) !== null;
  }

  /**
   * Clear specific rate from cache
   */
  delete(base: Currency, quote: Currency, provider?: string): boolean {
    const key = this.getCacheKey(base, quote, provider);
    const deleted = this.cache.delete(key);

    if (deleted) {
      logger.debug({ base, quote, provider }, 'Cache entry deleted');
    }

    return deleted;
  }

  /**
   * Clear all cached rates
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info({ clearedEntries: size }, 'Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    let expiredCount = 0;
    const now = Date.now();

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt.getTime()) {
        expiredCount++;
      }
    }

    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs,
      expiredCount,
      activeCount: this.cache.size - expiredCount,
    };
  }

  /**
   * Evict oldest (earliest expiry) entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt.getTime() < oldestTime) {
        oldestTime = entry.expiresAt.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug({ evictedKey: oldestKey }, 'Evicted oldest cache entry');
    }
  }

  /**
   * Clean up expired entries (garbage collection)
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt.getTime()) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug({ removed }, 'Cleaned up expired cache entries');
    }

    return removed;
  }
}

/**
 * Global rate cache instance
 */
let cacheInstance: RateCache | null = null;

/**
 * Get cache TTL based on token type
 * OPTIMIZATION: Stablecoins (USDC, USDT, AUDD) can be cached longer
 */
function getCacheTTL(tokenType?: string): number {
  // HBAR is volatile - cache for 60 seconds
  if (tokenType === 'HBAR') {
    return 60000; // 1 minute
  }
  
  // Stablecoins (USDC, USDT, AUDD) are stable - cache for 5 minutes
  if (tokenType === 'USDC' || tokenType === 'USDT' || tokenType === 'AUDD') {
    return 300000; // 5 minutes
  }
  
  // Default: 60 seconds
  return 60000;
}

/**
 * Get global rate cache instance
 */
export const getRateCache = (): RateCache => {
  if (!cacheInstance) {
    cacheInstance = new RateCache({
      ttlMs: 60000, // Default 60 seconds (can be overridden per token)
      maxEntries: 1000,
    });

    // Set up periodic cleanup (every 5 minutes)
    if (typeof setInterval !== 'undefined') {
      setInterval(() => {
        cacheInstance?.cleanup();
      }, 5 * 60 * 1000);
    }
  }

  return cacheInstance;
};

/**
 * Pre-warm cache with rates for all 4 tokens
 * Call this on app startup to reduce initial latency
 * 
 * @example
 * // In app initialization
 * await prewarmRateCache(['USD', 'AUD']);
 */
export async function prewarmRateCache(currencies: string[] = ['USD', 'AUD']): Promise<void> {
  const { log } = await import('@/lib/logger');
  const logger = log.child({ domain: 'fx:cache-prewarm' });

  logger.info({ currencies }, 'Pre-warming rate cache');

  try {
    const { fetchAllTokenRates } = await import('./providers/batch-rate-fetcher');
    const cache = getRateCache();

    // Fetch and cache rates for all tokens
    for (const currency of currencies) {
      const rates = await fetchAllTokenRates(currency as any);
      
      // Cache each rate
      for (const rate of Object.values(rates)) {
        cache.set(rate);
      }
    }

    logger.info({ currencies, tokenCount: 4 }, 'Rate cache pre-warmed successfully');
  } catch (error) {
    logger.error({ error, currencies }, 'Failed to pre-warm rate cache');
    // Don't throw - app can still start without pre-warmed cache
  }
}

/**
 * Start background cache refresh
 * Keeps cache warm by refreshing rates every 45 seconds
 */
export function startCacheRefresh(currencies: string[] = ['USD', 'AUD']): void {
  const { log } = require('@/lib/logger');
  const logger = log.child({ domain: 'fx:cache-refresh' });

  logger.info({ currencies }, 'Starting background cache refresh');

  // Initial pre-warm
  prewarmRateCache(currencies).catch(error => {
    logger.error({ error }, 'Initial cache pre-warm failed');
  });

  // Refresh every 45 seconds (before 60s TTL expires)
  setInterval(() => {
    prewarmRateCache(currencies).catch(error => {
      logger.error({ error }, 'Cache refresh failed');
    });
  }, 45000); // 45 seconds
}







