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
          const updated = await updatePaymentLinkWithTransaction(
            paymentLinkId,
            match,
            tokenType
          );

          const totalDuration = Date.now() - startTime;
          loggers.hedera.info(
            'Transaction found and processed',
            {
              paymentLinkId,
              transactionId: match.transactionId,
              duration: totalDuration,
              updated,
            }
          );

          return {
            found: true,
            transactionId: match.transactionId,
            amount: match.amount,
            sender: match.sender,
            timestamp: match.timestamp,
            updated,
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
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        loggers.hedera.warn('Transaction check timed out', { paymentLinkId });
        return { found: false, error: 'Timeout' };
      }

      throw error;
    }
  } catch (error: any) {
    const totalDuration = Date.now() - startTime;
    loggers.hedera.error(
      'Failed to check for transaction',
      { error: error.message, paymentLinkId, duration: totalDuration }
    );

    return {
      found: false,
      error: error.message || 'Unknown error',
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
      return null;
    }

    // Optional: Match memo if provided
    if (memo && tx.memo_base64) {
      const txMemo = Buffer.from(tx.memo_base64, 'base64').toString('utf-8');
      if (!txMemo.includes(memo)) {
        return null;
      }
    }

    // Validate amount (allow 0.5% tolerance for HBAR, 0.1% for stablecoins)
    const tolerance = tokenType === 'HBAR' ? 0.005 : 0.001;
    const minAmount = expectedAmount * (1 - tolerance);
    const maxAmount = expectedAmount * (1 + tolerance);

    if (amount < minAmount || amount > maxAmount) {
      // Amount mismatch
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
  tokenType: TokenType
): Promise<boolean> {
  try {
    // Check if this transaction was already recorded (idempotency)
    const existingEvent = await prisma.payment_events.findFirst({
      where: {
        payment_link_id: paymentLinkId,
        hedera_transaction_id: transaction.transactionId,
      },
    });

    if (existingEvent) {
      loggers.hedera.info(
        'Transaction already recorded - idempotent duplicate',
        { 
          paymentLinkId, 
          transactionId: transaction.transactionId,
          eventId: existingEvent.id 
        }
      );
      return true; // Already recorded, return success
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
      throw new Error('Payment link not found');
    }

    // If already PAID, log warning but don't fail
    if (paymentLink.status === 'PAID') {
      loggers.hedera.warn(
        'Payment link already marked as PAID',
        { paymentLinkId, existingStatus: paymentLink.status }
      );
      return true;
    }

    // Get or create ledger accounts for this organization
    const ledgerAccounts = await ensureLedgerAccounts(paymentLink.organization_id, tokenType);

    const now = new Date();
    const idempotencyKey = `hedera-${paymentLinkId}-${transaction.transactionId}`;

    await prisma.$transaction([
      // 1. Update payment link status
      prisma.payment_links.update({
        where: { id: paymentLinkId },
        data: {
          status: 'PAID',
          updated_at: now,
        },
      }),
      
      // 2. Create PAID event with full details
      prisma.payment_events.create({
        data: {
          payment_link_id: paymentLinkId,
          event_type: 'PAID',
          payment_method: 'HEDERA',
          hedera_transaction_id: transaction.transactionId,
          amount_received: transaction.amount,
          currency_received: tokenType, // Token type as currency
          metadata: {
            transactionId: transaction.transactionId,
            amount: transaction.amount,
            tokenType,
            sender: transaction.sender,
            timestamp: transaction.timestamp,
            memo: transaction.memo,
            merchantAccount: transaction.merchantAccount,
          },
        },
      }),
      
      // 3. Create ledger entry: DEBIT Crypto Clearing Account
      prisma.ledger_entries.create({
        data: {
          payment_link_id: paymentLinkId,
          ledger_account_id: ledgerAccounts.cryptoClearing,
          entry_type: 'DEBIT',
          amount: paymentLink.amount,
          currency: paymentLink.currency,
          description: `${tokenType} payment received - ${transaction.transactionId}`,
          idempotency_key: `${idempotencyKey}-debit`,
          created_at: now,
        },
      }),
      
      // 4. Create ledger entry: CREDIT Accounts Receivable
      prisma.ledger_entries.create({
        data: {
          payment_link_id: paymentLinkId,
          ledger_account_id: ledgerAccounts.accountsReceivable,
          entry_type: 'CREDIT',
          amount: paymentLink.amount,
          currency: paymentLink.currency,
          description: `${tokenType} payment received - ${transaction.transactionId}`,
          idempotency_key: `${idempotencyKey}-credit`,
          created_at: now,
        },
      }),
    ]);

    loggers.hedera.info(
      'Payment persisted successfully',
      {
        paymentLinkId,
        transactionId: transaction.transactionId,
        amount: transaction.amount,
        tokenType,
        sender: transaction.sender,
        ledgerEntries: {
          debit: ledgerAccounts.cryptoClearing,
          credit: ledgerAccounts.accountsReceivable,
        },
      }
    );

    return true;
  } catch (error) {
    loggers.hedera.error(
      'Failed to update payment link with transaction',
      error instanceof Error ? error : new Error(String(error)),
      { paymentLinkId, transactionId: transaction.transactionId }
    );
    return false;
  }
}

/**
 * Ensure ledger accounts exist for the organization
 * Returns account IDs for crypto clearing and accounts receivable
 */
async function ensureLedgerAccounts(
  organizationId: string,
  tokenType: TokenType
): Promise<{ cryptoClearing: string; accountsReceivable: string }> {
  // Get or create Crypto Clearing account for this token
  const cryptoCode = `1051-${tokenType}`;
  let cryptoAccount = await prisma.ledger_accounts.findFirst({
    where: {
      organization_id: organizationId,
      code: cryptoCode,
    },
  });

  if (!cryptoAccount) {
    cryptoAccount = await prisma.ledger_accounts.create({
      data: {
        organization_id: organizationId,
        code: cryptoCode,
        name: `Crypto Clearing - ${tokenType}`,
        account_type: 'ASSET',
      },
    });
    loggers.hedera.info('Created crypto clearing account', {
      organizationId,
      accountId: cryptoAccount.id,
      code: cryptoCode,
    });
  }

  // Get or create Accounts Receivable account
  const arCode = '1200';
  let arAccount = await prisma.ledger_accounts.findFirst({
    where: {
      organization_id: organizationId,
      code: arCode,
    },
  });

  if (!arAccount) {
    arAccount = await prisma.ledger_accounts.create({
      data: {
        organization_id: organizationId,
        code: arCode,
        name: 'Accounts Receivable',
        account_type: 'ASSET',
      },
    });
    loggers.hedera.info('Created accounts receivable account', {
      organizationId,
      accountId: arAccount.id,
      code: arCode,
    });
  }

  return {
    cryptoClearing: cryptoAccount.id,
    accountsReceivable: arAccount.id,
  };
}

