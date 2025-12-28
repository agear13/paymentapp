/**
 * Hedera Transaction Monitoring Service
 * Monitors for incoming transactions (HBAR and HTS tokens)
 */

import { log } from '@/lib/logger';
import {
  TOKEN_CONFIG,
  CURRENT_MIRROR_URL,
  TRANSACTION_POLLING,
  type TokenType,
} from './constants';
import type {
  TransactionResult,
  TransactionQueryOptions,
  MirrorTransaction,
} from './types';
import { fromSmallestUnit } from './token-service';

/**
 * Query recent transactions for an account
 */
export async function queryTransactions(
  options: TransactionQueryOptions
): Promise<MirrorTransaction[]> {
  const { accountId, tokenType, tokenId, startTime, limit = 10 } = options;

  try {
    log.info({ options }, 'Querying transactions');

    // Build query URL
    let url = `${CURRENT_MIRROR_URL}/api/v1/transactions?account.id=${accountId}&limit=${limit}&order=desc`;

    if (startTime) {
      const timestamp = Math.floor(startTime.getTime() / 1000);
      url += `&timestamp=gte:${timestamp}`;
    }

    // Filter by transaction type based on token
    if (tokenType === 'HBAR') {
      url += '&transactionType=CRYPTOTRANSFER';
    } else {
      url += '&transactionType=CRYPTOTRANSFER,TOKENTRANSFER';
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Mirror Node API error: ${response.status}`);
    }

    const data = await response.json();
    const transactions: MirrorTransaction[] = data.transactions || [];

    // Filter transactions based on token type
    const filteredTransactions = transactions.filter((tx) => {
      if (tokenType === 'HBAR') {
        // Check for HBAR transfers to the account
        return tx.transfers?.some(
          (transfer) =>
            transfer.account === accountId && transfer.amount > 0
        );
      } else {
        // Check for token transfers to the account
        return tx.token_transfers?.some(
          (transfer) =>
            transfer.account === accountId &&
            transfer.amount > 0 &&
            transfer.token_id === tokenId
        );
      }
    });

    log.info(
      { accountId, tokenType, count: filteredTransactions.length },
      'Transactions queried'
    );

    return filteredTransactions;
  } catch (error) {
    log.error({ error, options }, 'Failed to query transactions');
    return [];
  }
}

/**
 * Monitor for a specific payment transaction
 */
export async function monitorForPayment(
  accountId: string,
  tokenType: TokenType,
  expectedAmount: number,
  timeoutMs: number = TRANSACTION_POLLING.TIMEOUT_MS
): Promise<TransactionResult | null> {
  const startTime = new Date();
  const tokenId = TOKEN_CONFIG[tokenType].id || undefined;

  log.info(
    { accountId, tokenType, expectedAmount, timeoutMs },
    'Starting payment monitoring'
  );

  const endTime = Date.now() + timeoutMs;
  let attempts = 0;

  while (Date.now() < endTime && attempts < TRANSACTION_POLLING.MAX_ATTEMPTS) {
    attempts++;

    try {
      const transactions = await queryTransactions({
        accountId,
        tokenType,
        tokenId,
        startTime,
        limit: 5,
      });

      // Check if any transaction matches the expected payment
      for (const tx of transactions) {
        const result = parseTransaction(tx, accountId, tokenType, expectedAmount);
        
        if (result && result.success) {
          log.info(
            { transactionId: result.transactionId, result },
            'Payment transaction found'
          );
          return result;
        }
      }

      // Wait before next poll
      await new Promise((resolve) =>
        setTimeout(resolve, TRANSACTION_POLLING.INTERVAL_MS)
      );
    } catch (error) {
      log.error({ error, attempt: attempts }, 'Error during payment monitoring');
    }
  }

  log.warn(
    { accountId, tokenType, attempts },
    'Payment monitoring timeout - no matching transaction found'
  );

  return null;
}

/**
 * Parse a Mirror Node transaction into TransactionResult
 */
export function parseTransaction(
  tx: MirrorTransaction,
  accountId: string,
  tokenType: TokenType,
  expectedAmount?: number
): TransactionResult | null {
  try {
    let amount = 0;
    let sender = '';

    if (tokenType === 'HBAR') {
      // Parse HBAR transfer
      const transfer = tx.transfers?.find(
        (t) => t.account === accountId && t.amount > 0
      );

      if (!transfer) {
        return null;
      }

      amount = fromSmallestUnit(transfer.amount, 'HBAR');
      
      // Find sender (negative amount)
      const senderTransfer = tx.transfers?.find((t) => t.amount < 0);
      sender = senderTransfer?.account || 'unknown';
    } else {
      // Parse token transfer
      const tokenId = TOKEN_CONFIG[tokenType].id;
      const transfer = tx.token_transfers?.find(
        (t) =>
          t.account === accountId &&
          t.amount > 0 &&
          t.token_id === tokenId
      );

      if (!transfer) {
        return null;
      }

      amount = fromSmallestUnit(transfer.amount, tokenType);
      
      // Find sender
      const senderTransfer = tx.token_transfers?.find(
        (t) => t.token_id === tokenId && t.amount < 0
      );
      sender = senderTransfer?.account || 'unknown';
    }

    // Validate amount if expected amount provided
    let isValid = true;
    let validationError: string | undefined;

    if (expectedAmount !== undefined) {
      const difference = Math.abs(amount - expectedAmount);
      const percentDiff = (difference / expectedAmount) * 100;

      if (amount < expectedAmount * 0.995) {
        // Less than 99.5% of expected (accounting for 0.5% tolerance)
        isValid = false;
        validationError = `Underpayment: Received ${amount} ${tokenType}, expected ${expectedAmount} ${tokenType}`;
      }
    }

    const result: TransactionResult = {
      success: true,
      transactionId: tx.transaction_id,
      tokenType,
      amount: amount.toString(),
      timestamp: tx.consensus_timestamp,
      sender,
      memo: tx.memo_base64
        ? Buffer.from(tx.memo_base64, 'base64').toString('utf-8')
        : undefined,
      isValid,
      validationError,
    };

    return result;
  } catch (error) {
    log.error({ error, tx }, 'Failed to parse transaction');
    return null;
  }
}

/**
 * Get transaction by ID
 */
export async function getTransaction(
  transactionId: string
): Promise<MirrorTransaction | null> {
  try {
    const url = `${CURRENT_MIRROR_URL}/api/v1/transactions/${transactionId}`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.transactions?.[0] || null;
  } catch (error) {
    log.error({ error, transactionId }, 'Failed to get transaction');
    return null;
  }
}

/**
 * Check if a transaction is confirmed (has consensus timestamp)
 */
export function isTransactionConfirmed(tx: MirrorTransaction): boolean {
  return tx.result === 'SUCCESS' && !!tx.consensus_timestamp;
}

/**
 * Extract memo from transaction
 */
export function extractMemo(tx: MirrorTransaction): string | null {
  if (!tx.memo_base64) {
    return null;
  }

  try {
    return Buffer.from(tx.memo_base64, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}












