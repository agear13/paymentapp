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

    // Get or create ledger accounts for this organization
    const ledgerAccounts = await ensureLedgerAccounts(paymentLink.organization_id, tokenType);

    const now = new Date();
    // Use correlation_id as base for idempotency keys
    const idempotencyKey = correlationId;
    
    // Build Mirror Node URL for metadata
    const mirrorUrl = network === 'mainnet'
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';

    // === WRAP DB PERSISTENCE IN TRY/CATCH ===
    try {
      // INSTRUMENTATION: Log exact payloads being passed to Prisma
      const updatePayload = {
        where: { id: paymentLinkId },
        data: {
          status: 'PAID' as const,
          updated_at: now,
        },
      };
      
      const eventPayload = {
        data: {
          payment_link_id: paymentLinkId,
          event_type: 'PAYMENT_CONFIRMED' as const,
          payment_method: 'HEDERA' as const,
          hedera_transaction_id: normalizedTxId,
          amount_received: transaction.amount,
          currency_received: tokenType,
          correlation_id: correlationId,
          metadata: {
            transactionId: transaction.transactionId,
            raw_transaction_id: transaction.transactionId,
            normalized_transaction_id: normalizedTxId,
            amount: transaction.amount,
            tokenType,
            sender: transaction.sender,
            // transaction.timestamp is set from tx.consensus_timestamp in parseAndMatchTransaction (line 275)
            consensus_timestamp: transaction.timestamp,
            memo: transaction.memo,
            merchantAccount: transaction.merchantAccount,
            network,
            mirror_url: mirrorUrl,
            payer_account_id: transaction.sender,
          },
        },
      };
      
      const debitPayload = {
        data: {
          payment_link_id: paymentLinkId,
          ledger_account_id: ledgerAccounts.cryptoClearing,
          entry_type: 'DEBIT' as const,
          amount: paymentLink.amount,
          currency: paymentLink.currency,
          description: `${tokenType} payment received - ${normalizedTxId}`,
          idempotency_key: `${idempotencyKey}-debit`,
          created_at: now,
        },
      };
      
      const creditPayload = {
        data: {
          payment_link_id: paymentLinkId,
          ledger_account_id: ledgerAccounts.accountsReceivable,
          entry_type: 'CREDIT' as const,
          amount: paymentLink.amount,
          currency: paymentLink.currency,
          description: `${tokenType} payment received - ${normalizedTxId}`,
          idempotency_key: `${idempotencyKey}-credit`,
          created_at: now,
        },
      };
      
      loggers.hedera.info(
        'INSTRUMENTATION: Prisma payloads before transaction',
        {
          updatePayload: {
            where: updatePayload.where,
            dataKeys: Object.keys(updatePayload.data),
            hasId: 'id' in updatePayload.data,
          },
          eventPayload: {
            dataKeys: Object.keys(eventPayload.data),
            hasId: 'id' in eventPayload.data,
          },
          debitPayload: {
            dataKeys: Object.keys(debitPayload.data),
            hasId: 'id' in debitPayload.data,
          },
          creditPayload: {
            dataKeys: Object.keys(creditPayload.data),
            hasId: 'id' in creditPayload.data,
          },
        }
      );
      
      await prisma.$transaction([
        // 1. Update payment link status
        prisma.payment_links.update(updatePayload),
        
        // 2. Create payment event with full details
        prisma.payment_events.create(eventPayload),
        
        // 3. Create ledger entry: DEBIT Crypto Clearing Account
        prisma.ledger_entries.create(debitPayload),
        
        // 4. Create ledger entry: CREDIT Accounts Receivable
        prisma.ledger_entries.create(creditPayload),
      ]);

      loggers.hedera.info(
        'Payment persisted successfully',
        {
          paymentLinkId,
          transactionId: transaction.transactionId,
          correlationId,
          amount: transaction.amount,
          tokenType,
          sender: transaction.sender,
          ledgerEntries: {
            debit: ledgerAccounts.cryptoClearing,
            credit: ledgerAccounts.accountsReceivable,
          },
        }
      );

      return { success: true };
    } catch (err: unknown) {
      // Log detailed error with all context
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[monitor] persist failed', {
        paymentLinkId,
        transactionId: transaction.transactionId,
        correlationId,
        sender: transaction.sender,
        amount: transaction.amount,
        token: tokenType,
        network,
      }, err);
      
      loggers.hedera.error(
        'Prisma transaction failed during persistence',
        err instanceof Error ? err : new Error(String(err)),
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
  } catch (error) {
    // Catch outer errors (e.g., ensureLedgerAccounts failures)
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

/**
 * Ensure ledger accounts exist for the organization (idempotent)
 * Returns account IDs for crypto clearing and accounts receivable
 */
async function ensureLedgerAccounts(
  organizationId: string,
  tokenType: TokenType
): Promise<{ cryptoClearing: string; accountsReceivable: string }> {
  // Upsert Crypto Clearing account for this token (idempotent)
  const cryptoCode = `1051-${tokenType}`;
  const cryptoAccount = await prisma.ledger_accounts.upsert({
    where: {
      organization_id_code: {
        organization_id: organizationId,
        code: cryptoCode,
      },
    },
    update: {},
    create: {
      organization_id: organizationId,
      code: cryptoCode,
      name: `Crypto Clearing - ${tokenType}`,
      account_type: 'ASSET',
    },
  });

  loggers.hedera.info('Ensured crypto clearing account exists', {
    organizationId,
    accountId: cryptoAccount.id,
    code: cryptoCode,
  });

  // Upsert Accounts Receivable account (idempotent)
  const arCode = '1200';
  const arAccount = await prisma.ledger_accounts.upsert({
    where: {
      organization_id_code: {
        organization_id: organizationId,
        code: arCode,
      },
    },
    update: {},
    create: {
      organization_id: organizationId,
      code: arCode,
      name: 'Accounts Receivable',
      account_type: 'ASSET',
    },
  });

  loggers.hedera.info('Ensured accounts receivable account exists', {
    organizationId,
    accountId: arAccount.id,
    code: arCode,
  });

  return {
    cryptoClearing: cryptoAccount.id,
    accountsReceivable: arAccount.id,
  };
}

