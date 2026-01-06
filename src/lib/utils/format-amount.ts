/**
 * Format currency amounts for both fiat and crypto currencies
 * 
 * Handles:
 * - Fiat currencies (USD, AUD, etc.) via Intl.NumberFormat
 * - Crypto tokens (HBAR, USDC, USDT, AUDD) with appropriate decimal precision
 */

import { TOKEN_CONFIG } from '@/lib/hedera/constants';

const CRYPTO_CURRENCIES = ['HBAR', 'USDC', 'USDT', 'AUDD', 'BTC', 'ETH'] as const;

type CryptoCurrency = typeof CRYPTO_CURRENCIES[number];

/**
 * Check if currency code is a cryptocurrency
 */
function isCryptoCurrency(currency: string): currency is CryptoCurrency {
  return CRYPTO_CURRENCIES.includes(currency as CryptoCurrency);
}

/**
 * Get decimal places for a currency
 */
function getDecimalPlaces(currency: string): number {
  if (isCryptoCurrency(currency)) {
    // Use TOKEN_CONFIG if available, otherwise default to 8
    const tokenConfig = TOKEN_CONFIG[currency as keyof typeof TOKEN_CONFIG];
    return tokenConfig?.decimals ?? 8;
  }
  // Fiat currencies typically use 2 decimals
  return 2;
}

/**
 * Format currency symbol for crypto
 */
function getCryptoSymbol(currency: CryptoCurrency): string {
  const symbols: Record<CryptoCurrency, string> = {
    HBAR: 'ℏ',
    USDC: '$',
    USDT: '₮',
    AUDD: 'A$',
    BTC: '₿',
    ETH: 'Ξ',
  };
  return symbols[currency] || currency;
}

/**
 * Format amount with currency
 * Handles both fiat currencies (via Intl.NumberFormat) and crypto tokens
 * 
 * @param amount - The amount to format
 * @param currency - Currency code (e.g., 'USD', 'AUD', 'HBAR', 'USDC')
 * @returns Formatted currency string
 * 
 * @example
 * formatAmount(1000, 'USD') // => '$1,000.00'
 * formatAmount(1.23456789, 'HBAR') // => 'ℏ1.23456789'
 * formatAmount(100.5, 'USDC') // => '$100.500000'
 */
export function formatAmount(
  amount: number,
  currency: string
): string {
  // Handle crypto currencies
  if (isCryptoCurrency(currency)) {
    const decimals = getDecimalPlaces(currency);
    const symbol = getCryptoSymbol(currency);
    const formatted = amount.toFixed(decimals);
    
    // Add thousands separators for readability
    const [whole, decimal] = formatted.split('.');
    const wholeWithCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    return decimal 
      ? `${symbol}${wholeWithCommas}.${decimal}`
      : `${symbol}${wholeWithCommas}`;
  }

  // Handle fiat currencies with Intl.NumberFormat
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    // Fallback for unknown currencies
    console.warn(`Unknown currency: ${currency}. Using fallback formatting.`);
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Format amount with code (no symbol)
 * Useful for displaying amounts in tables
 * 
 * @example
 * formatAmountWithCode(1000, 'HBAR') // => '1,000.00000000 HBAR'
 * formatAmountWithCode(100, 'USD') // => '100.00 USD'
 */
export function formatAmountWithCode(
  amount: number,
  currency: string
): string {
  const decimals = getDecimalPlaces(currency);
  const formatted = amount.toFixed(decimals);
  
  // Add thousands separators
  const [whole, decimal] = formatted.split('.');
  const wholeWithCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  return decimal 
    ? `${wholeWithCommas}.${decimal} ${currency}`
    : `${wholeWithCommas} ${currency}`;
}

/**
 * Format amount without symbol or code
 * Just the number with proper decimal places
 * 
 * @example
 * formatAmountOnly(1.23456789, 'HBAR') // => '1.23456789'
 * formatAmountOnly(1000.5, 'USD') // => '1,000.50'
 */
export function formatAmountOnly(
  amount: number,
  currency: string
): string {
  const decimals = getDecimalPlaces(currency);
  const formatted = amount.toFixed(decimals);
  
  // Add thousands separators
  const [whole, decimal] = formatted.split('.');
  const wholeWithCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  return decimal 
    ? `${wholeWithCommas}.${decimal}`
    : wholeWithCommas;
}

