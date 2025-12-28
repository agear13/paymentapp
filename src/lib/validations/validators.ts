/**
 * Custom Validators for Provvypay
 * Specialized validation functions for domain-specific formats
 */

// ============================================================================
// ISO 4217 CURRENCY CODE VALIDATOR
// ============================================================================

export const ISO_4217_CURRENCIES = [
  // Major Fiat Currencies
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD',
  // Asian Currencies
  'CNY', 'HKD', 'SGD', 'INR', 'KRW', 'THB', 'MYR', 'IDR',
  'PHP', 'VND', 'TWD',
  // European Currencies
  'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON',
  // Middle East & Africa
  'AED', 'SAR', 'ZAR', 'EGP', 'TRY', 'ILS',
  // Americas
  'BRL', 'MXN', 'ARS', 'CLP', 'COP', 'PEN',
  // Crypto (non-standard but supported)
  'HBAR', 'USDC', 'USDT', 'BTC', 'ETH',
] as const;

export type ISO4217Currency = (typeof ISO_4217_CURRENCIES)[number];

/**
 * Validates if a string is a valid ISO 4217 currency code
 */
export const validateCurrencyCode = (code: string): boolean => {
  if (!code || typeof code !== 'string') return false;
  
  const normalizedCode = code.toUpperCase().trim();
  
  // Check format: exactly 3 uppercase letters
  if (!/^[A-Z]{3}$/.test(normalizedCode)) return false;
  
  // Check against known ISO 4217 codes
  return ISO_4217_CURRENCIES.includes(normalizedCode as ISO4217Currency);
};

/**
 * Validates and normalizes currency code (uppercase, trimmed)
 */
export const normalizeCurrencyCode = (code: string): string | null => {
  if (!validateCurrencyCode(code)) return null;
  return code.toUpperCase().trim();
};

// ============================================================================
// HEDERA ACCOUNT ID VALIDATOR
// ============================================================================

/**
 * Hedera account ID format: 0.0.xxxxx
 * Example: 0.0.12345
 */
export const validateHederaAccountId = (accountId: string): boolean => {
  if (!accountId || typeof accountId !== 'string') return false;
  
  const pattern = /^0\.0\.\d+$/;
  return pattern.test(accountId.trim());
};

/**
 * Extracts the account number from Hedera account ID
 * Example: "0.0.12345" -> 12345
 */
export const extractHederaAccountNumber = (accountId: string): number | null => {
  if (!validateHederaAccountId(accountId)) return null;
  
  const parts = accountId.split('.');
  return parseInt(parts[2], 10);
};

/**
 * Validates Hedera account ID is within valid range
 */
export const validateHederaAccountRange = (accountId: string): boolean => {
  const accountNumber = extractHederaAccountNumber(accountId);
  if (!accountNumber) return false;
  
  // Hedera account numbers typically range from 1 to several million
  // Treasury accounts are 1-100, user accounts start from 1000+
  return accountNumber >= 1 && accountNumber <= 999999999;
};

// ============================================================================
// HEDERA TRANSACTION ID VALIDATOR
// ============================================================================

/**
 * Hedera transaction ID formats:
 * - 0.0.xxxxx@xxx.xxxxxxxxx
 * - 0.0.xxxxx-xxx-xxx@xxx.xxxxxxxxx
 */
export const validateHederaTransactionId = (transactionId: string): boolean => {
  if (!transactionId || typeof transactionId !== 'string') return false;
  
  // Format: accountId@seconds.nanoseconds or accountId-shard-realm@seconds.nanoseconds
  const pattern = /^0\.0\.\d+[-@]\d+\.\d+$/;
  return pattern.test(transactionId.trim());
};

/**
 * Parses Hedera transaction ID into components
 */
export const parseHederaTransactionId = (
  transactionId: string
): {
  accountId: string;
  timestamp: string;
} | null => {
  if (!validateHederaTransactionId(transactionId)) return null;
  
  const parts = transactionId.split('@');
  if (parts.length !== 2) return null;
  
  return {
    accountId: parts[0],
    timestamp: parts[1],
  };
};

// ============================================================================
// INVOICE REFERENCE VALIDATOR
// ============================================================================

/**
 * Invoice reference validation rules:
 * - Alphanumeric characters, dashes, underscores
 * - 1-255 characters
 * - No special characters that could cause URL/SQL injection issues
 */
export const validateInvoiceReference = (reference: string): boolean => {
  if (!reference || typeof reference !== 'string') return false;
  
  const trimmed = reference.trim();
  
  // Check length
  if (trimmed.length < 1 || trimmed.length > 255) return false;
  
  // Check format: alphanumeric, dashes, underscores only
  const pattern = /^[a-zA-Z0-9_-]+$/;
  return pattern.test(trimmed);
};

/**
 * Normalizes invoice reference (trim, validate format)
 */
export const normalizeInvoiceReference = (reference: string): string | null => {
  if (!validateInvoiceReference(reference)) return null;
  return reference.trim();
};

// ============================================================================
// SHORT CODE VALIDATOR
// ============================================================================

/**
 * Short code validation rules:
 * - Exactly 8 characters
 * - URL-safe characters (alphanumeric, dash, underscore)
 * - Used for payment link URLs: /pay/{shortCode}
 */
export const validateShortCode = (code: string): boolean => {
  if (!code || typeof code !== 'string') return false;
  
  // Must be exactly 8 characters
  if (code.length !== 8) return false;
  
  // URL-safe characters only
  const pattern = /^[a-zA-Z0-9_-]+$/;
  return pattern.test(code);
};

/**
 * Generates a URL-safe short code
 * Uses base62 encoding (a-z, A-Z, 0-9) without confusing characters
 */
export const generateShortCode = (): string => {
  // Remove confusing characters: 0, O, I, l, 1
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  
  for (let i = 0; i < 8; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }
  
  return code;
};

// ============================================================================
// AMOUNT VALIDATORS
// ============================================================================

/**
 * Validates payment amount
 * - Must be positive
 * - Maximum 2 decimal places for fiat
 * - Maximum 8 decimal places for crypto
 */
export const validateAmount = (
  amount: number,
  currency: string,
  maxDecimals: number = 2
): boolean => {
  if (typeof amount !== 'number' || isNaN(amount)) return false;
  
  // Must be positive
  if (amount <= 0) return false;
  
  // Check decimal places
  const decimalPlaces = (amount.toString().split('.')[1] || '').length;
  
  // Crypto currencies allow more decimal places
  const isCrypto = ['HBAR', 'USDC', 'USDT', 'BTC', 'ETH'].includes(currency);
  const maxAllowedDecimals = isCrypto ? 8 : maxDecimals;
  
  return decimalPlaces <= maxAllowedDecimals;
};

/**
 * Rounds amount to appropriate decimal places
 */
export const roundAmount = (amount: number, currency: string): number => {
  const isCrypto = ['HBAR', 'USDC', 'USDT', 'BTC', 'ETH'].includes(currency);
  const decimals = isCrypto ? 8 : 2;
  
  return Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

// ============================================================================
// EMAIL & PHONE VALIDATORS
// ============================================================================

/**
 * Enhanced email validation
 */
export const validateEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  
  const trimmed = email.trim();
  
  // Length check
  if (trimmed.length > 255) return false;
  
  // RFC 5322 simplified regex
  const pattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  return pattern.test(trimmed);
};

/**
 * International phone number validation
 * Supports E.164 format: +[country code][number]
 */
export const validatePhone = (phone: string): boolean => {
  if (!phone || typeof phone !== 'string') return false;
  
  const trimmed = phone.trim();
  
  // Length check (E.164 allows 1-15 digits after +)
  if (trimmed.length > 50) return false;
  
  // E.164 format: +[1-9][0-9]{1,14}
  const pattern = /^\+?[1-9]\d{1,14}$/;
  
  return pattern.test(trimmed.replace(/[\s()-]/g, ''));
};

/**
 * Normalizes phone number to E.164 format
 */
export const normalizePhone = (phone: string): string | null => {
  if (!phone) return null;
  
  // Remove spaces, dashes, parentheses
  let normalized = phone.replace(/[\s()-]/g, '');
  
  // Add + prefix if missing
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }
  
  return validatePhone(normalized) ? normalized : null;
};

// ============================================================================
// DATE/TIME VALIDATORS
// ============================================================================

/**
 * Validates expiry timestamp is in the future
 */
export const validateExpiryDate = (expiryDate: Date | string): boolean => {
  try {
    const date = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
    
    if (isNaN(date.getTime())) return false;
    
    // Must be in the future
    return date > new Date();
  } catch {
    return false;
  }
};

/**
 * Validates timestamp is not too far in the past (for FX snapshots)
 */
export const validateSnapshotTimestamp = (
  timestamp: Date,
  maxAgeMinutes: number = 30
): boolean => {
  const now = new Date();
  const ageMilliseconds = now.getTime() - timestamp.getTime();
  const ageMinutes = ageMilliseconds / (1000 * 60);
  
  return ageMinutes >= 0 && ageMinutes <= maxAgeMinutes;
};

// ============================================================================
// IDEMPOTENCY KEY VALIDATOR
// ============================================================================

/**
 * Generates idempotency key for ledger entries
 * Format: {paymentLinkId}:{eventType}:{timestamp}
 */
export const generateIdempotencyKey = (
  paymentLinkId: string,
  eventType: string,
  timestamp?: Date
): string => {
  const ts = timestamp || new Date();
  return `${paymentLinkId}:${eventType}:${ts.toISOString()}`;
};

/**
 * Validates idempotency key format
 */
export const validateIdempotencyKey = (key: string): boolean => {
  if (!key || typeof key !== 'string') return false;
  
  // Check length
  if (key.length > 255) return false;
  
  // Must contain at least 2 colons (3 parts)
  const parts = key.split(':');
  return parts.length >= 3;
};

// ============================================================================
// STRIPE PAYMENT INTENT ID VALIDATOR
// ============================================================================

/**
 * Stripe Payment Intent ID format: pi_[alphanumeric]
 */
export const validateStripePaymentIntentId = (id: string): boolean => {
  if (!id || typeof id !== 'string') return false;
  
  const pattern = /^pi_[a-zA-Z0-9]+$/;
  return pattern.test(id.trim());
};

// ============================================================================
// XERO ACCOUNT CODE VALIDATOR
// ============================================================================

/**
 * Validates Xero account code format
 * Typically 3-10 characters, alphanumeric
 */
export const validateXeroAccountCode = (code: string): boolean => {
  if (!code || typeof code !== 'string') return false;
  
  const trimmed = code.trim();
  
  // Length check
  if (trimmed.length < 1 || trimmed.length > 50) return false;
  
  // Alphanumeric with optional dashes
  const pattern = /^[a-zA-Z0-9-]+$/;
  return pattern.test(trimmed);
};

// ============================================================================
// BALANCE VALIDATION (Double-Entry Bookkeeping)
// ============================================================================

/**
 * Validates that debits equal credits in ledger entries
 */
export const validateLedgerBalance = (
  entries: Array<{
    entryType: 'DEBIT' | 'CREDIT';
    amount: number;
  }>
): { valid: boolean; debitTotal: number; creditTotal: number; difference: number } => {
  const debitTotal = entries
    .filter((e) => e.entryType === 'DEBIT')
    .reduce((sum, e) => sum + e.amount, 0);
  
  const creditTotal = entries
    .filter((e) => e.entryType === 'CREDIT')
    .reduce((sum, e) => sum + e.amount, 0);
  
  // Allow for small rounding errors (0.001)
  const difference = Math.abs(debitTotal - creditTotal);
  const valid = difference < 0.001;
  
  return {
    valid,
    debitTotal,
    creditTotal,
    difference,
  };
};

// ============================================================================
// EXPORTS
// ============================================================================

export const validators = {
  // Currency
  validateCurrencyCode,
  normalizeCurrencyCode,
  ISO_4217_CURRENCIES,
  
  // Hedera
  validateHederaAccountId,
  extractHederaAccountNumber,
  validateHederaAccountRange,
  validateHederaTransactionId,
  parseHederaTransactionId,
  
  // Invoice & Short Code
  validateInvoiceReference,
  normalizeInvoiceReference,
  validateShortCode,
  generateShortCode,
  
  // Amounts
  validateAmount,
  roundAmount,
  
  // Contact Info
  validateEmail,
  validatePhone,
  normalizePhone,
  
  // Date/Time
  validateExpiryDate,
  validateSnapshotTimestamp,
  
  // Idempotency
  generateIdempotencyKey,
  validateIdempotencyKey,
  
  // External IDs
  validateStripePaymentIntentId,
  validateXeroAccountCode,
  
  // Ledger
  validateLedgerBalance,
};

export default validators;













