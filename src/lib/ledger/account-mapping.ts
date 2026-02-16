/**
 * Token-to-Account Mapping Utility
 * Maps cryptocurrency tokens to their respective ledger clearing accounts
 * 
 * CRITICAL: Each token has its own clearing account for proper reconciliation
 * - HBAR → 1051
 * - USDC → 1052
 * - USDT → 1053
 * - AUDD → 1054
 */

import type { TokenType } from '@/lib/hedera/constants';
import type { PaymentToken } from '@prisma/client';

/**
 * Standard ledger account codes
 */
export const LEDGER_ACCOUNTS = {
  ACCOUNTS_RECEIVABLE: '1200',
  STRIPE_CLEARING: '1050',
  CRYPTO_CLEARING_HBAR: '1051',
  CRYPTO_CLEARING_USDC: '1052',
  CRYPTO_CLEARING_USDT: '1053',
  CRYPTO_CLEARING_AUDD: '1054',
  PROCESSOR_FEE_EXPENSE: '6100',
  REVENUE: '4000',
  // Commission / Revenue Share (Option B)
  COMMISSION_EXPENSE: '6105',
  CONSULTANT_PAYABLE: '2110',
  BD_PARTNER_PAYABLE: '2120',
  /** Generic partner payable when beneficiary not yet assigned */
  PARTNER_PAYABLE_UNASSIGNED: '2130',
} as const;

/**
 * Mapping of cryptocurrency tokens to clearing account codes
 */
export const CRYPTO_CLEARING_ACCOUNTS: Record<TokenType, string> = {
  HBAR: LEDGER_ACCOUNTS.CRYPTO_CLEARING_HBAR,
  USDC: LEDGER_ACCOUNTS.CRYPTO_CLEARING_USDC,
  USDT: LEDGER_ACCOUNTS.CRYPTO_CLEARING_USDT,
  AUDD: LEDGER_ACCOUNTS.CRYPTO_CLEARING_AUDD,
} as const;

/**
 * Get clearing account code for a specific token
 * 
 * @param tokenType - The cryptocurrency token type (HBAR, USDC, USDT, AUDD)
 * @returns The ledger account code for that token's clearing account
 * @throws Error if token type is invalid
 * 
 * @example
 * ```typescript
 * const accountCode = getCryptoClearingAccountCode('AUDD');
 * // Returns: '1054'
 * ```
 */
export function getCryptoClearingAccountCode(tokenType: TokenType): string {
  const accountCode = CRYPTO_CLEARING_ACCOUNTS[tokenType];

  if (!accountCode) {
    throw new Error(`No clearing account mapped for token: ${tokenType}`);
  }

  return accountCode;
}

/**
 * Get clearing account code from Prisma PaymentToken enum
 * Convenience function for use with database models
 */
export function getCryptoClearingAccountCodeFromPaymentToken(
  paymentToken: PaymentToken
): string {
  return getCryptoClearingAccountCode(paymentToken as TokenType);
}

/**
 * Get all crypto clearing account codes
 * Useful for queries that need to filter by crypto accounts
 * 
 * @returns Array of all crypto clearing account codes
 * 
 * @example
 * ```typescript
 * const codes = getAllCryptoClearingAccounts();
 * // Returns: ['1051', '1052', '1053', '1054']
 * ```
 */
export function getAllCryptoClearingAccounts(): string[] {
  return Object.values(CRYPTO_CLEARING_ACCOUNTS);
}

/**
 * Validate that an account code is a valid crypto clearing account
 * 
 * @param accountCode - The account code to validate
 * @returns True if the code is a crypto clearing account
 * 
 * @example
 * ```typescript
 * isCryptoClearingAccount('1054'); // true (AUDD)
 * isCryptoClearingAccount('1200'); // false (Accounts Receivable)
 * ```
 */
export function isCryptoClearingAccount(accountCode: string): boolean {
  return Object.values(CRYPTO_CLEARING_ACCOUNTS).includes(accountCode);
}

/**
 * Get token type from clearing account code (reverse lookup)
 * 
 * @param accountCode - The clearing account code
 * @returns The token type, or null if not a crypto clearing account
 * 
 * @example
 * ```typescript
 * getTokenFromClearingAccount('1054'); // 'AUDD'
 * getTokenFromClearingAccount('1200'); // null
 * ```
 */
export function getTokenFromClearingAccount(accountCode: string): TokenType | null {
  const entry = Object.entries(CRYPTO_CLEARING_ACCOUNTS).find(
    ([_, code]) => code === accountCode
  );
  return entry ? (entry[0] as TokenType) : null;
}

/**
 * Validate that the correct clearing account is used for a token
 * Throws error if mismatch detected
 * 
 * @param tokenType - The token type being paid
 * @param clearingAccountCode - The account code being used
 * @throws Error if account code doesn't match token type
 * 
 * @example
 * ```typescript
 * // This is correct
 * validateTokenAccountMapping('AUDD', '1054'); // No error
 * 
 * // This will throw an error
 * validateTokenAccountMapping('AUDD', '1051'); // Error: Invalid clearing account
 * ```
 */
export function validateTokenAccountMapping(
  tokenType: TokenType,
  clearingAccountCode: string
): void {
  const expectedAccount = getCryptoClearingAccountCode(tokenType);

  if (clearingAccountCode !== expectedAccount) {
    throw new Error(
      `Invalid clearing account for ${tokenType}. ` +
        `Expected ${expectedAccount}, got ${clearingAccountCode}. ` +
        `Each token must use its designated clearing account for proper reconciliation.`
    );
  }
}

/**
 * Get a human-readable name for a clearing account
 * 
 * @param accountCode - The account code
 * @returns A descriptive name
 */
export function getClearingAccountName(accountCode: string): string {
  const tokenType = getTokenFromClearingAccount(accountCode);

  if (tokenType) {
    return `Crypto Clearing - ${tokenType}`;
  }

  if (accountCode === LEDGER_ACCOUNTS.STRIPE_CLEARING) {
    return 'Stripe Clearing';
  }

  return 'Unknown Clearing Account';
}

/**
 * Get all standard account codes as a typed object
 * Useful for queries and validation
 */
export function getAllStandardAccounts(): typeof LEDGER_ACCOUNTS {
  return LEDGER_ACCOUNTS;
}

/**
 * Check if an account code exists in the standard chart
 * 
 * @param accountCode - The account code to check
 * @returns True if the code is a standard account
 */
export function isStandardAccount(accountCode: string): boolean {
  return Object.values(LEDGER_ACCOUNTS).includes(accountCode);
}






