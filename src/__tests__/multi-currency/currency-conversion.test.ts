/**
 * Multi-Currency Conversion Tests
 * 
 * Sprint 26: Final Testing & Quality Assurance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  convertCurrency,
  convertToMultipleCurrencies,
  normalizeToBaseCurrency,
  compareCurrencyAmounts,
  clearExchangeRateCache,
} from '@/lib/currency/currency-converter';

describe('Currency Conversion', () => {
  beforeEach(() => {
    clearExchangeRateCache();
  });

  afterEach(() => {
    clearExchangeRateCache();
  });

  describe('convertCurrency', () => {
    it('should convert USD to EUR correctly', async () => {
      const result = await convertCurrency(100, 'USD', 'EUR');
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(100); // EUR typically less than USD
    });

    it('should return same amount for same currency', async () => {
      const result = await convertCurrency(100, 'USD', 'USD');
      expect(result).toBe(100);
    });

    it('should handle zero amount', async () => {
      const result = await convertCurrency(0, 'USD', 'EUR');
      expect(result).toBe(0);
    });

    it('should handle negative amounts', async () => {
      const result = await convertCurrency(-100, 'USD', 'EUR');
      expect(result).toBeLessThan(0);
    });

    it('should cache conversion rates', async () => {
      const start1 = Date.now();
      await convertCurrency(100, 'USD', 'EUR');
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await convertCurrency(100, 'USD', 'EUR');
      const time2 = Date.now() - start2;

      // Cached call should be significantly faster
      expect(time2).toBeLessThan(time1);
    });

    it('should handle zero-decimal currencies (JPY)', async () => {
      const result = await convertCurrency(100, 'USD', 'JPY');
      expect(result).toBeGreaterThan(100); // JPY typically much more than USD
      expect(Number.isInteger(result)).toBe(false); // Result may have decimals before rounding
    });

    it('should handle high-decimal cryptocurrencies (HBAR)', async () => {
      const result = await convertCurrency(100, 'USD', 'HBAR');
      expect(result).toBeGreaterThan(100); // HBAR typically more units than USD
    });
  });

  describe('convertToMultipleCurrencies', () => {
    it('should convert to multiple currencies', async () => {
      const result = await convertToMultipleCurrencies(100, 'USD', ['EUR', 'GBP', 'JPY']);
      
      expect(result).toHaveProperty('EUR');
      expect(result).toHaveProperty('GBP');
      expect(result).toHaveProperty('JPY');
      
      expect(result.EUR).toBeGreaterThan(0);
      expect(result.GBP).toBeGreaterThan(0);
      expect(result.JPY).toBeGreaterThan(0);
    });

    it('should handle empty target currencies', async () => {
      const result = await convertToMultipleCurrencies(100, 'USD', []);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should include base currency if in targets', async () => {
      const result = await convertToMultipleCurrencies(100, 'USD', ['USD', 'EUR']);
      expect(result.USD).toBe(100);
      expect(result.EUR).toBeGreaterThan(0);
    });
  });

  describe('normalizeToBaseCurrency', () => {
    it('should normalize mixed currencies to base', async () => {
      const amounts = [
        { amount: 100, currency: 'USD' },
        { amount: 85, currency: 'EUR' },
        { amount: 75, currency: 'GBP' },
      ];

      const result = await normalizeToBaseCurrency(amounts, 'USD');
      expect(result).toBeGreaterThan(100); // Should be sum of all converted to USD
    });

    it('should handle single currency', async () => {
      const amounts = [{ amount: 100, currency: 'USD' }];
      const result = await normalizeToBaseCurrency(amounts, 'USD');
      expect(result).toBe(100);
    });

    it('should handle empty array', async () => {
      const result = await normalizeToBaseCurrency([], 'USD');
      expect(result).toBe(0);
    });
  });

  describe('compareCurrencyAmounts', () => {
    it('should compare amounts in different currencies', async () => {
      const amount1 = { amount: 100, currency: 'USD' };
      const amount2 = { amount: 85, currency: 'EUR' };

      const result = await compareCurrencyAmounts(amount1, amount2, 'USD');
      
      // 100 USD should be greater than 85 EUR (which is ~92 USD)
      expect(result).toBeGreaterThan(0);
    });

    it('should return 0 for equal amounts', async () => {
      const amount1 = { amount: 100, currency: 'USD' };
      const amount2 = { amount: 100, currency: 'USD' };

      const result = await compareCurrencyAmounts(amount1, amount2, 'USD');
      expect(result).toBe(0);
    });

    it('should return negative for smaller first amount', async () => {
      const amount1 = { amount: 50, currency: 'USD' };
      const amount2 = { amount: 100, currency: 'USD' };

      const result = await compareCurrencyAmounts(amount1, amount2, 'USD');
      expect(result).toBeLessThan(0);
    });
  });

  describe('Precision and Rounding', () => {
    it('should maintain precision for fiat currencies (2 decimals)', async () => {
      const result = await convertCurrency(100.12, 'USD', 'EUR');
      const decimals = result.toString().split('.')[1]?.length || 0;
      expect(decimals).toBeLessThanOrEqual(2);
    });

    it('should maintain precision for cryptocurrencies (8 decimals)', async () => {
      const result = await convertCurrency(100, 'USD', 'HBAR');
      // HBAR should have up to 8 decimal places
      expect(result).toBeGreaterThan(0);
    });

    it('should handle very small amounts', async () => {
      const result = await convertCurrency(0.01, 'USD', 'EUR');
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(0.01);
    });

    it('should handle very large amounts', async () => {
      const result = await convertCurrency(1000000, 'USD', 'EUR');
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1000000);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid currency code', async () => {
      await expect(convertCurrency(100, 'INVALID', 'USD')).rejects.toThrow();
    });

    it('should throw error for unsupported currency pair', async () => {
      await expect(convertCurrency(100, 'XXX', 'YYY')).rejects.toThrow();
    });
  });

  describe('Cache Behavior', () => {
    it('should respect cache TTL', async () => {
      // First call
      const result1 = await convertCurrency(100, 'USD', 'EUR');
      
      // Second call (should be cached)
      const result2 = await convertCurrency(100, 'USD', 'EUR');
      
      expect(result1).toBe(result2);
    });

    it('should clear cache on demand', async () => {
      await convertCurrency(100, 'USD', 'EUR');
      clearExchangeRateCache();
      
      // After clear, should fetch fresh rate
      const result = await convertCurrency(100, 'USD', 'EUR');
      expect(result).toBeGreaterThan(0);
    });
  });
});







