/**
 * Hedera Settlement Posting Rules
 * Double-entry accounting rules for Hedera cryptocurrency payments
 * 
 * CRITICAL: Each token has its own clearing account
 * - HBAR → 1051 (Crypto Clearing - HBAR)
 * - USDC → 1052 (Crypto Clearing - USDC)
 * - USDT → 1053 (Crypto Clearing - USDT)
 * - AUDD → 1054 (Crypto Clearing - AUDD)
 * 
 * Posting Logic:
 * DR Crypto Clearing (token-specific), CR Accounts Receivable (1200)
 * Amount is in invoice currency (converted via FX rate)
 */

import { LedgerEntryService, JournalEntry } from '../ledger-entry-service';
import {
  getCryptoClearing AccountCode,
  validateTokenAccountMapping,
  LEDGER_ACCOUNTS,
} from '../account-mapping';
import type { TokenType } from '@/lib/hedera/constants';
import { TOKEN_CONFIG, TOKEN_IDS } from '@/lib/hedera/constants';
import type { PaymentToken } from '@prisma/client';
import { loggers } from '@/lib/logger';

/**
 * Get current network (mainnet/testnet)
 */
function getNetwork(): 'MAINNET' | 'TESTNET' {
  const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
  return network === 'mainnet' ? 'MAINNET' : 'TESTNET';
}

/**
 * Parameters for Hedera settlement posting
 */
export interface HederaSettlementParams {
  paymentLinkId: string;
  organizationId: string;
  tokenType: TokenType; // HBAR | USDC | USDT | AUDD
  cryptoAmount: string; // Amount in crypto (with decimals)
  invoiceAmount: string; // Amount in invoice currency
  invoiceCurrency: string; // ISO 4217 currency code
  fxRate: number; // Exchange rate used
  transactionId: string; // Hedera transaction ID
}

/**
 * Post Hedera settlement to ledger
 * 
 * Creates journal entries:
 * DR Crypto Clearing (token-specific account), CR Accounts Receivable
 * 
 * @param params - Settlement parameters
 * @returns Promise<void>
 * @throws Error if posting fails or wrong clearing account used
 */
export async function postHederaSettlement(
  params: HederaSettlementParams
): Promise<void> {
  const {
    paymentLinkId,
    organizationId,
    tokenType,
    cryptoAmount,
    invoiceAmount,
    invoiceCurrency,
    fxRate,
    transactionId,
  } = params;

  loggers.ledger.info(
    {
      paymentLinkId,
      tokenType,
      cryptoAmount,
      invoiceAmount,
      invoiceCurrency,
      fxRate,
      transactionId,
    },
    'Starting Hedera settlement posting'
  );

  const ledgerService = new LedgerEntryService();

  // Get the correct clearing account for this token
  const clearingAccountCode = getCryptoClearing AccountCode(tokenType);

  // Validate that we're using the right account for this token
  validateTokenAccountMapping(tokenType, clearingAccountCode);

  // Get token details for description
  const tokenConfig = TOKEN_CONFIG[tokenType];
  const tokenId = TOKEN_IDS[getNetwork()]?.[tokenType as keyof typeof TOKEN_IDS['MAINNET' | 'TESTNET']];

  // Build comprehensive description
  const description = buildHederaDescription({
    tokenType,
    tokenId,
    transactionId,
    cryptoAmount,
    invoiceAmount,
    invoiceCurrency,
    fxRate,
  });

  // Create journal entries
  const entries: JournalEntry[] = [
    {
      accountCode: clearingAccountCode, // 1051/1052/1053/1054
      entryType: 'DEBIT',
      amount: invoiceAmount,
      currency: invoiceCurrency,
      description,
    },
    {
      accountCode: LEDGER_ACCOUNTS.ACCOUNTS_RECEIVABLE, // 1200
      entryType: 'CREDIT',
      amount: invoiceAmount,
      currency: invoiceCurrency,
      description,
    },
  ];

  // Post entries atomically
  await ledgerService.postJournalEntries({
    entries,
    paymentLinkId,
    organizationId,
    idempotencyKey: `hedera-settlement-${transactionId}`,
  });

  // Log the posting for audit
  loggers.ledger.info(
    {
      paymentLinkId,
      tokenType,
      clearingAccount: clearingAccountCode,
      amount: invoiceAmount,
      currency: invoiceCurrency,
      transactionId,
    },
    'Hedera settlement posted successfully'
  );
}

/**
 * Build detailed description for Hedera ledger entry
 */
function buildHederaDescription(params: {
  tokenType: TokenType;
  tokenId?: string;
  transactionId: string;
  cryptoAmount: string;
  invoiceAmount: string;
  invoiceCurrency: string;
  fxRate: number;
}): string {
  const {
    tokenType,
    tokenId,
    transactionId,
    cryptoAmount,
    invoiceAmount,
    invoiceCurrency,
    fxRate,
  } = params;

  const tokenConfig = TOKEN_CONFIG[tokenType];

  const parts = [
    `${tokenType} payment via Hedera network`,
    `Transaction ID: ${transactionId}`,
    `Token: ${tokenConfig.name} (${tokenType})${tokenId ? ` [${tokenId}]` : ''}`,
    `Crypto amount: ${cryptoAmount} ${tokenType}`,
    `Exchange rate: ${fxRate} ${tokenType}/${invoiceCurrency}`,
    `Invoice amount: ${invoiceAmount} ${invoiceCurrency}`,
  ];

  // Add special notes for specific tokens
  if (tokenType === 'AUDD' && invoiceCurrency === 'AUD') {
    parts.push('✓ Currency-matched payment (AUDD/AUD) - No FX risk');
  } else if (tokenConfig.isStablecoin) {
    parts.push(`✓ Stablecoin payment - Lower volatility`);
  }

  return parts.join('\n');
}

/**
 * Post Hedera settlement from Prisma PaymentToken enum
 * Convenience wrapper for use with database models
 */
export async function postHederaSettlementFromPaymentToken(
  params: Omit<HederaSettlementParams, 'tokenType'> & { paymentToken: PaymentToken }
): Promise<void> {
  return postHederaSettlement({
    ...params,
    tokenType: params.paymentToken as TokenType,
  });
}

/**
 * Validate that the correct clearing account will be used for a token
 * Call this before posting to catch configuration errors
 * 
 * @param tokenType - The token type
 * @returns The clearing account code that will be used
 * @throws Error if token is invalid
 */
export function validateHederaPosting(tokenType: TokenType): string {
  const clearingAccountCode = getCryptoClearing AccountCode(tokenType);
  validateTokenAccountMapping(tokenType, clearingAccountCode);
  return clearingAccountCode;
}

/**
 * Get clearing account code for a token (without validation)
 * Useful for queries and UI display
 * 
 * @param tokenType - The token type
 * @returns The clearing account code
 */
export function getHederaClearing Account(tokenType: TokenType): string {
  return getCryptoClearing AccountCode(tokenType);
}

/**
 * Get all Hedera clearing account codes
 * Useful for filtering and reporting
 * 
 * @returns Array of all crypto clearing account codes
 */
export function getAllHederaClearing Accounts(): string[] {
  return [
    getCryptoClearing AccountCode('HBAR'),
    getCryptoClearing AccountCode('USDC'),
    getCryptoClearing AccountCode('USDT'),
    getCryptoClearing AccountCode('AUDD'),
  ];
}

/**
 * Build settlement parameters from payment event and FX snapshot
 * Helper for integration with existing payment flow
 */
export interface BuildSettlementParamsInput {
  paymentLinkId: string;
  organizationId: string;
  paymentEvent: {
    payment_token: PaymentToken;
    hedera_transaction_id: string | null;
    amount_received: any; // Decimal or string
  };
  paymentLink: {
    amount: any; // Decimal or string
    currency: string;
  };
  fxSnapshot: {
    rate: any; // Decimal or number
  };
}

export function buildHederaSettlementParams(
  input: BuildSettlementParamsInput
): HederaSettlementParams {
  const {
    paymentLinkId,
    organizationId,
    paymentEvent,
    paymentLink,
    fxSnapshot,
  } = input;

  if (!paymentEvent.hedera_transaction_id) {
    throw new Error('Hedera transaction ID is required');
  }

  return {
    paymentLinkId,
    organizationId,
    tokenType: paymentEvent.payment_token as TokenType,
    cryptoAmount: paymentEvent.amount_received.toString(),
    invoiceAmount: paymentLink.amount.toString(),
    invoiceCurrency: paymentLink.currency,
    fxRate: typeof fxSnapshot.rate === 'number' 
      ? fxSnapshot.rate 
      : parseFloat(fxSnapshot.rate.toString()),
    transactionId: paymentEvent.hedera_transaction_id,
  };
}






