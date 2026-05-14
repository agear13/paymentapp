/**
 * Hedera Transaction Checker
 * Fast, non-blocking transaction verification (check once, no polling)
 */

import { loggers } from '@/lib/logger';
import {
  TOKEN_CONFIG,
  type TokenType,
} from './constants';
import type {
  TransactionResult,
  MirrorTransaction,
} from './types';
import { fromSmallestUnit } from './token-service';
import { prisma } from '@/lib/server/prisma';
import { generateCorrelationId } from '@/lib/services/correlation';
import { normalizeHederaTransactionId } from './txid';
import { confirmPayment } from '@/lib/services/payment-confirmation';

export interface CheckTransactionOptions {
  paymentLinkId: string;
  merchantAccountId: string;
  payerAccountId?: string;
  network: 'testnet' | 'mainnet';
  tokenType: TokenType;
  expectedAmount: number;
  memo?: string;
  timeWindowMinutes?: number; // How far back to search (default 15)
}

export interface CheckTransactionResult {
  found: boolean;
  transactionId?: string;
  amount?: string;
  sender?: string;
  timestamp?: string;
  updated?: boolean;
  error?: string;
  persistError?: string;
}

/**
 * Check for a matching transaction (single bounded query, no blocking)
 * Maximum execution time: 8 seconds
 */
export async function checkForTransaction(
  options: CheckTransactionOptions
): Promise<CheckTransactionResult> {
  const {
    paymentLinkId,
    merchantAccountId,
    payerAccountId,
    network,
    tokenType,
    expectedAmount,
    memo,
    timeWindowMinutes = 15,
  } = options;

  const startTime = Date.now();

  try {
    loggers.hedera.info(
      'Checking for transaction',
      {
        paymentLinkId,
        merchantAccountId,
        tokenType,
        expectedAmount,
        timeWindowMinutes,
      }
    );

    // Create AbortController with 7s timeout (leave 1s buffer for DB update)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    try {
      // Build mirror node query URL
      const tokenId = TOKEN_CONFIG[tokenType].id;
      const mirrorUrl = network === 'mainnet'
        ? 'https://mainnet-public.mirrornode.hedera.com'
        : 'https://testnet.mirrornode.hedera.com';

      // Search transactions to merchant account in the last N minutes
      const startTimestamp = Math.floor((Date.now() - timeWindowMinutes * 60 * 1000) / 1000);
      let url = `${mirrorUrl}/api/v1/transactions?account.id=${merchantAccountId}&limit=20&order=desc&timestamp=gte:${startTimestamp}`;

      // Filter by transaction type
      if (tokenType === 'HBAR') {
        url += '&transactionType=CRYPTOTRANSFER';
      } else {
        url += '&transactionType=CRYPTOTRANSFER,TOKENTRANSFER';
      }

      const queryStart = Date.now();
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      const queryDuration = Date.now() - queryStart;
      loggers.hedera.info('Mirror node query completed', { queryDuration, url });

      if (!response.ok) {
        throw new Error(`Mirror node returned ${response.status}`);
      }

      const data = await response.json();
      const transactions: MirrorTransaction[] = data.transactions || [];

      // Enhanced logging for debugging
      loggers.hedera.info('Mirror node response', {
        transactionCount: transactions.length,
        searchCriteria: {
          merchantAccountId,
          tokenType,
          tokenId,
          expectedAmount,
          payerAccountId,
          memo,
          timeWindowMinutes,
        },
        firstTxId: transactions[0]?.transaction_id,
        firstTxTimestamp: transactions[0]?.consensus_timestamp,
      });

      // Parse and find matching transaction
      for (const tx of transactions) {
        const match = parseAndMatchTransaction(
          tx,
          merchantAccountId,
          tokenType,
          tokenId,
          expectedAmount,
          payerAccountId,
          memo
        );

        if (match) {
          // Transaction found! Update database
          const persistResult = await updatePaymentLinkWithTransaction(
            paymentLinkId,
            match,
            tokenType,
            network
          );

          const totalDuration = Date.now() - startTime;
          loggers.hedera.info(
            'Transaction found and processed',
            {
              paymentLinkId,
              transactionId: match.transactionId,
              duration: totalDuration,
              updated: persistResult.success,
              persistError: persistResult.error,
            }
          );

          return {
            found: true,
            transactionId: match.transactionId,
            amount: match.amount,
            sender: match.sender,
            timestamp: match.timestamp,
            updated: persistResult.success,
            persistError: persistResult.error,
          };
        }
      }

      // No matching transaction found
      const totalDuration = Date.now() - startTime;
      loggers.hedera.info(
        'No matching transaction found',
        { paymentLinkId, duration: totalDuration, transactionsChecked: transactions.length }
      );

      return { found: false };
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        loggers.hedera.warn('Transaction check timed out', { paymentLinkId });
        return { found: false, error: 'Timeout' };
      }

      throw error;
    }
  } catch (error: unknown) {
    const totalDuration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    loggers.hedera.error(
      'Failed to check for transaction',
      { error: errorMessage, paymentLinkId, duration: totalDuration }
    );

    return {
      found: false,
      error: errorMessage || 'Unknown error',
    };
  }
}

/**
 * Parse and match a single transaction against criteria
 */
function parseAndMatchTransaction(
  tx: MirrorTransaction,
  merchantAccountId: string,
  tokenType: TokenType,
  tokenId: string | null | undefined,
  expectedAmount: number,
  payerAccountId?: string,
  memo?: string
): TransactionResult | null {
  try {
    let amount = 0;
    let sender = '';
    let found = false;

    if (tokenType === 'HBAR') {
      // Check HBAR transfer to merchant
      const transfer = tx.transfers?.find(
        (t) => t.account === merchantAccountId && t.amount > 0
      );

      if (!transfer) {
        return null;
      }

      amount = fromSmallestUnit(transfer.amount, 'HBAR');
      found = true;

      // Find sender
      const senderTransfer = tx.transfers?.find((t) => t.amount < 0);
      sender = senderTransfer?.account || 'unknown';
    } else {
      // Check token transfer to merchant
      const transfer = tx.token_transfers?.find(
        (t) =>
          t.account === merchantAccountId &&
          t.amount > 0 &&
          t.token_id === tokenId
      );

      if (!transfer) {
        return null;
      }

      amount = fromSmallestUnit(transfer.amount, tokenType);
      found = true;

      // Find sender
      const senderTransfer = tx.token_transfers?.find(
        (t) => t.token_id === tokenId && t.amount < 0
      );
      sender = senderTransfer?.account || 'unknown';
    }

    if (!found) {
      return null;
    }

    // Optional: Match payer account if provided
    if (payerAccountId && sender !== payerAccountId) {
      loggers.hedera.debug('Transaction payer mismatch', {
        transactionId: tx.transaction_id,
        expected: payerAccountId,
        actual: sender,
      });
      return null;
    }

    // Optional: Match memo if provided
    if (memo && tx.memo_base64) {
      const txMemo = Buffer.from(tx.memo_base64, 'base64').toString('utf-8');
      if (!txMemo.includes(memo)) {
        loggers.hedera.debug('Transaction memo mismatch', {
          transactionId: tx.transaction_id,
          expected: memo,
          actual: txMemo,
        });
        return null;
      }
    }

    // Validate amount (allow 0.5% tolerance for HBAR, 0.1% for stablecoins)
    const tolerance = tokenType === 'HBAR' ? 0.005 : 0.001;
    const minAmount = expectedAmount * (1 - tolerance);
    const maxAmount = expectedAmount * (1 + tolerance);

    if (amount < minAmount || amount > maxAmount) {
      // Amount mismatch
      loggers.hedera.debug('Transaction amount mismatch', {
        transactionId: tx.transaction_id,
        expected: expectedAmount,
        actual: amount,
        minAccepted: minAmount,
        maxAccepted: maxAmount,
        tolerance: `${tolerance * 100}%`,
      });
      return null;
    }

    return {
      success: true,
      transactionId: tx.transaction_id,
      tokenType,
      amount: amount.toString(),
      timestamp: tx.consensus_timestamp,
      sender,
      merchantAccount: merchantAccountId,
      memo: tx.memo_base64
        ? Buffer.from(tx.memo_base64, 'base64').toString('utf-8')
        : undefined,
      isValid: true,
    };
  } catch (error) {
    loggers.hedera.error('Failed to parse transaction', { error, transactionId: tx.transaction_id });
    return null;
  }
}

/**
 * Update payment link in database with transaction details
 */
async function updatePaymentLinkWithTransaction(
  paymentLinkId: string,
  transaction: TransactionResult,
  tokenType: TokenType,
  network: 'testnet' | 'mainnet'
): Promise<{ success: boolean; error?: string }> {
  // Normalize transaction ID to canonical dash format for consistent storage
  const normalizedTxId = normalizeHederaTransactionId(transaction.transactionId);
  
  // Generate correlation ID from normalized transaction ID
  const correlationId = generateCorrelationId('hedera', normalizedTxId);
  
  try {
    
    // Check if this transaction was already recorded (idempotency)
    // Check both formats for backwards compatibility with mixed writes
    const existingEvent = await prisma.payment_events.findFirst({
      where: {
        payment_link_id: paymentLinkId,
        OR: [
          { hedera_transaction_id: normalizedTxId },
          { hedera_transaction_id: transaction.transactionId },
          { correlation_id: correlationId },
        ],
      },
    });

    if (existingEvent) {
      loggers.hedera.info(
        'Transaction already recorded - idempotent duplicate',
        { 
          paymentLinkId, 
          transactionId: transaction.transactionId,
          correlationId,
          eventId: existingEvent.id 
        }
      );
      return { success: true }; // Already recorded, return success
    }

    // Get payment link details for ledger entries
    const paymentLink = await prisma.payment_links.findUnique({
      where: { id: paymentLinkId },
      select: {
        id: true,
        organization_id: true,
        amount: true,
        currency: true,
        invoice_currency: true,
        status: true,
      },
    });

    if (!paymentLink) {
      const error = 'Payment link not found';
      console.error('[monitor] persist failed', {
        paymentLinkId,
        transactionId: transaction.transactionId,
        sender: transaction.sender,
        amount: transaction.amount,
        token: tokenType,
        network,
        error,
      });
      return { success: false, error };
    }

    // If already PAID, log warning but don't fail
    if (paymentLink.status === 'PAID') {
      loggers.hedera.warn(
        'Payment link already marked as PAID',
        { paymentLinkId, existingStatus: paymentLink.status }
      );
      return { success: true };
    }

    const mirrorUrl =
      network === 'mainnet'
        ? 'https://mainnet-public.mirrornode.hedera.com'
        : 'https://testnet.mirrornode.hedera.com';

    const amountReceived = parseFloat(String(transaction.amount));

    const confirmResult = await confirmPayment({
      paymentLinkId,
      provider: 'hedera',
      providerRef: transaction.transactionId,
      transactionId: normalizedTxId,
      amountReceived,
      currencyReceived: tokenType,
      tokenType,
      correlationId,
      metadata: {
        transactionId: transaction.transactionId,
        raw_transaction_id: transaction.transactionId,
        normalized_transaction_id: normalizedTxId,
        amount: transaction.amount,
        tokenType,
        token_type: tokenType,
        sender: transaction.sender,
        consensus_timestamp: transaction.timestamp,
        memo: transaction.memo,
        merchantAccount: transaction.merchantAccount,
        network,
        mirror_url: mirrorUrl,
        payer_account_id: transaction.sender,
        source: 'hedera-transaction-checker',
      },
    });

    if (!confirmResult.success) {
      const msg = confirmResult.error || 'confirmPayment failed';
      loggers.hedera.error('Hedera confirmPayment failed (transaction-checker)', {
        paymentLinkId,
        transactionId: transaction.transactionId,
        correlationId,
        tokenType,
        network,
        error: msg,
      });
      return { success: false, error: msg };
    }

    loggers.hedera.info('Payment persisted via confirmPayment (transaction-checker)', {
      paymentLinkId,
      transactionId: transaction.transactionId,
      correlationId,
      amount: transaction.amount,
      tokenType,
      sender: transaction.sender,
      paymentEventId: confirmResult.paymentEventId,
    });

    return { success: true };
  } catch (error) {
    // Catch outer errors (e.g., confirmPayment / prisma read failures)
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[monitor] persist failed', {
      paymentLinkId,
      transactionId: transaction.transactionId,
      correlationId,
      sender: transaction.sender,
      amount: transaction.amount,
      token: tokenType,
      network,
    }, error);
    
    loggers.hedera.error(
      'Failed to update payment link with transaction',
      error instanceof Error ? error : new Error(String(error)),
      { 
        paymentLinkId, 
        transactionId: transaction.transactionId,
        correlationId,
        sender: transaction.sender,
        amount: transaction.amount,
        tokenType,
        network,
      }
    );
    
    return { success: false, error: errorMessage };
  }
}
