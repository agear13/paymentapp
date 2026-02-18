/**
 * Hedera Amount Conversion Utilities
 * Safe conversion between token amounts and smallest units
 * Supports HBAR (8 decimals) and HTS tokens (typically 6 decimals)
 */

/** Only digits with optional decimal part; no scientific notation (e/E). */
const VALID_AMOUNT_REGEX = /^\d+(\.\d+)?$/;

/**
 * Generic: Convert token amount to smallest unit (string-based, no floats).
 * Safe for money/token amounts: no parseFloat/toFixed to avoid rounding/precision bugs.
 *
 * @param amount - Amount in token units (e.g., "15.046618" or 15.046618); prefer string.
 * @param decimals - Number of decimals (e.g., 6 for USDC, 8 for HBAR)
 * @returns Amount in smallest unit (bigint)
 */
export function toSmallestUnit(amount: number | string, decimals: number): bigint {
  if (decimals < 0 || decimals > 18) {
    throw new Error('Decimals must be between 0 and 18');
  }

  const amountStr =
    typeof amount === 'string' ? amount.trim() : String(amount);
  if (amountStr === '' || /[eE]/.test(amountStr)) {
    throw new Error('Invalid amount: scientific notation or empty');
  }
  if (!VALID_AMOUNT_REGEX.test(amountStr)) {
    throw new Error('Invalid amount: expected digits with optional decimal (e.g. 12.34)');
  }

  const [whole, fractional = ''] = amountStr.split('.');
  if (fractional.length > decimals) {
    throw new Error(
      `Amount has too many decimal places (max ${decimals}); do not round payouts`
    );
  }
  if (whole.startsWith('-') || amountStr.startsWith('-')) {
    throw new Error('Amount cannot be negative');
  }

  const paddedFractional = fractional.padEnd(decimals, '0');
  const combined = whole + paddedFractional;
  return BigInt(combined);
}

/**
 * Generic: Convert smallest unit to token amount
 * 
 * @param smallestUnit - Amount in smallest unit (e.g., 15046618 for USDC)
 * @param decimals - Number of decimals (e.g., 6 for USDC, 8 for HBAR)
 * @returns Amount in token units (string with proper decimals)
 */
export function fromSmallestUnit(smallestUnit: bigint | number | string, decimals: number): string {
  const value = typeof smallestUnit === 'bigint' 
    ? smallestUnit 
    : BigInt(smallestUnit);
  
  if (value < BigInt(0)) {
    throw new Error('Smallest unit amount cannot be negative');
  }
  
  if (decimals < 0 || decimals > 18) {
    throw new Error('Decimals must be between 0 and 18');
  }
  
  const valueStr = value.toString().padStart(decimals + 1, '0');
  const whole = valueStr.slice(0, -decimals) || '0';
  const decimal = valueStr.slice(-decimals);
  
  return `${whole}.${decimal}`;
}

/**
 * Convert HBAR amount to tinybars
 * HBAR has 8 decimals, so 1 HBAR = 100,000,000 tinybars
 * 
 * @param hbarAmount - Amount in HBAR (e.g., 15.04661831)
 * @returns Amount in tinybars (integer)
 */
export function hbarToTinybars(hbarAmount: number | string): bigint {
  return toSmallestUnit(hbarAmount, 8);
}

/**
 * Convert tinybars to HBAR
 * 
 * @param tinybars - Amount in tinybars (integer)
 * @returns Amount in HBAR (string with 8 decimals)
 */
export function tinybarsToHbar(tinybars: bigint | number | string): string {
  return fromSmallestUnit(tinybars, 8);
}

/**
 * Format token amount for display
 * 
 * @param amount - Amount in token units
 * @param decimals - Number of decimal places to show
 * @returns Formatted token string
 */
export function formatTokenAmount(amount: number | string, decimals: number): string {
  const amountValue = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(amountValue) || !isFinite(amountValue)) {
    return '0.' + '0'.repeat(decimals);
  }
  
  return amountValue.toFixed(decimals);
}

/**
 * Format HBAR amount for display
 * 
 * @param hbarAmount - Amount in HBAR
 * @param decimals - Number of decimal places to show (default: 8)
 * @returns Formatted HBAR string
 */
export function formatHbar(hbarAmount: number | string, decimals: number = 8): string {
  return formatTokenAmount(hbarAmount, decimals);
}

/**
 * Validate token amount is within reasonable bounds
 * 
 * @param amount - Amount in token units
 * @param maxAmount - Maximum allowed amount (default: 1 billion)
 * @returns true if valid
 */
export function isValidTokenAmount(amount: number | string, maxAmount: number = 1_000_000_000): boolean {
  const amountValue = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(amountValue) || !isFinite(amountValue)) {
    return false;
  }
  
  if (amountValue < 0) {
    return false;
  }
  
  if (amountValue > maxAmount) {
    return false;
  }
  
  return true;
}

/**
 * Validate HBAR amount is within reasonable bounds
 * 
 * @param hbarAmount - Amount in HBAR
 * @returns true if valid
 */
export function isValidHbarAmount(hbarAmount: number | string): boolean {
  return isValidTokenAmount(hbarAmount, 100_000_000);
}

