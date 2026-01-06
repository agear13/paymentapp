/**
 * Hedera Amount Conversion Utilities
 * Safe conversion between HBAR and tinybars (8 decimals)
 */

/**
 * Convert HBAR amount to tinybars
 * HBAR has 8 decimals, so 1 HBAR = 100,000,000 tinybars
 * 
 * @param hbarAmount - Amount in HBAR (e.g., 15.04661831)
 * @returns Amount in tinybars (integer)
 */
export function hbarToTinybars(hbarAmount: number | string): bigint {
  const amount = typeof hbarAmount === 'string' ? parseFloat(hbarAmount) : hbarAmount;
  
  if (isNaN(amount) || !isFinite(amount)) {
    throw new Error('Invalid HBAR amount');
  }
  
  if (amount < 0) {
    throw new Error('HBAR amount cannot be negative');
  }
  
  // Use string manipulation to avoid floating point precision issues
  const amountStr = amount.toFixed(8); // Ensure 8 decimal places
  const [whole, decimal = ''] = amountStr.split('.');
  
  // Pad decimal to 8 digits
  const paddedDecimal = decimal.padEnd(8, '0').slice(0, 8);
  
  // Combine and convert to bigint
  const tinybarsStr = whole + paddedDecimal;
  return BigInt(tinybarsStr);
}

/**
 * Convert tinybars to HBAR
 * 
 * @param tinybars - Amount in tinybars (integer)
 * @returns Amount in HBAR (string with 8 decimals)
 */
export function tinybarsToHbar(tinybars: bigint | number | string): string {
  const tinybarsValue = typeof tinybars === 'bigint' 
    ? tinybars 
    : BigInt(tinybars);
  
  if (tinybarsValue < 0n) {
    throw new Error('Tinybars amount cannot be negative');
  }
  
  const tinybarsStr = tinybarsValue.toString().padStart(9, '0'); // At least 1.00000000
  const whole = tinybarsStr.slice(0, -8) || '0';
  const decimal = tinybarsStr.slice(-8);
  
  return `${whole}.${decimal}`;
}

/**
 * Format HBAR amount for display
 * 
 * @param hbarAmount - Amount in HBAR
 * @param decimals - Number of decimal places to show (default: 8)
 * @returns Formatted HBAR string
 */
export function formatHbar(hbarAmount: number | string, decimals: number = 8): string {
  const amount = typeof hbarAmount === 'string' ? parseFloat(hbarAmount) : hbarAmount;
  
  if (isNaN(amount) || !isFinite(amount)) {
    return '0.00000000';
  }
  
  return amount.toFixed(decimals);
}

/**
 * Validate HBAR amount is within reasonable bounds
 * 
 * @param hbarAmount - Amount in HBAR
 * @returns true if valid
 */
export function isValidHbarAmount(hbarAmount: number | string): boolean {
  const amount = typeof hbarAmount === 'string' ? parseFloat(hbarAmount) : hbarAmount;
  
  if (isNaN(amount) || !isFinite(amount)) {
    return false;
  }
  
  if (amount < 0) {
    return false;
  }
  
  // Reasonable upper bound: 100 million HBAR
  if (amount > 100_000_000) {
    return false;
  }
  
  return true;
}

