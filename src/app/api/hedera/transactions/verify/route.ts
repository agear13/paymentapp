/**
 * POST /api/hedera/transactions/verify
 * Manually verify a specific transaction by ID
 * Used when automatic monitoring fails or times out
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { loggers } from '@/lib/logger';
import { prisma } from '@/lib/server/prisma';
import type { TokenType } from '@/lib/hedera/constants';
import { TOKEN_CONFIG } from '@/lib/hedera/constants';
import { fromSmallestUnit } from '@/lib/hedera/token-service';
import { generateCorrelationId } from '@/lib/services/correlation';

const requestSchema = z.object({
  paymentLinkId: z.string().uuid(),
  transactionId: z.string().regex(/^0\.0\.\d+[@-]\d+\.\d+$/),
  network: z.enum(['testnet', 'mainnet']),
});

interface MirrorTransaction {
  transaction_id: string;
  consensus_timestamp: string;
  charged_tx_fee: number;
  memo_base64?: string;
  result: string;
  name: string;
  transfers?: Array<{
    account: string;
    amount: number;
    is_approval: boolean;
  }>;
  token_transfers?: Array<{
    token_id: string;
    account: string;
    amount: number;
    is_approval: boolean;
  }>;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const validated = requestSchema.parse(body);

    // Generate correlation ID for tracing
    const correlationId = generateCorrelationId('hedera', validated.transactionId);

    loggers.hedera.info('Manual transaction verification requested', {
      paymentLinkId: validated.paymentLinkId,
      transactionId: validated.transactionId,
      network: validated.network,
      correlationId,
    });

    // Check for existing event (idempotency)
    const existingEvent = await prisma.payment_events.findFirst({
      where: {
        payment_link_id: validated.paymentLinkId,
        OR: [
          {
            hedera_transaction_id: validated.transactionId,
          },
          {
            correlation_id: correlationId,
          },
        ],
      },
    });

    if (existingEvent) {
      loggers.hedera.info('Transaction already processed - idempotent', {
        paymentLinkId: validated.paymentLinkId,
        transactionId: validated.transactionId,
        correlationId,
        existingEventId: existingEvent.id,
      });
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        message: 'Transaction already verified and processed',
        paymentEventId: existingEvent.id,
        correlationId,
      });
    }

    // Get payment link details
    const paymentLink = await prisma.payment_links.findUnique({
      where: { id: validated.paymentLinkId },
      select: {
        id: true,
        organization_id: true,
        status: true,
        amount: true,
        currency: true,
      },
    });

    if (!paymentLink) {
      return NextResponse.json(
        { error: 'Payment link not found' },
        { status: 404 }
      );
    }

    // If already paid, return success
    if (paymentLink.status === 'PAID') {
      return NextResponse.json({
        success: true,
        alreadyPaid: true,
        message: 'Payment link already marked as paid',
      });
    }

    // Fetch transaction from mirror node
    const mirrorUrl = validated.network === 'mainnet'
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';

    // URL-encode the transaction ID (@ symbol becomes %40)
    const encodedTxId = encodeURIComponent(validated.transactionId);
    const txUrl = `${mirrorUrl}/api/v1/transactions/${encodedTxId}`;
    
    loggers.hedera.info('Querying mirror node for transaction', {
      transactionId: validated.transactionId,
      url: txUrl,
      correlationId,
    });
    
    const response = await fetch(txUrl);

    if (!response.ok) {
      loggers.hedera.error('Failed to fetch transaction from mirror node', {
        transactionId: validated.transactionId,
        url: txUrl,
        status: response.status,
        statusText: response.statusText,
        correlationId,
      });
      return NextResponse.json(
        { error: 'Transaction not found on Hedera network' },
        { status: 404 }
      );
    }

    const data = await response.json();
    
    loggers.hedera.info('Mirror node response received', {
      transactionId: validated.transactionId,
      hasTransactions: !!data.transactions,
      transactionCount: data.transactions?.length || 0,
      correlationId,
    });
    
    const tx: MirrorTransaction = data.transactions?.[0];

    if (!tx) {
      loggers.hedera.warn('Transaction array empty in mirror node response', {
        transactionId: validated.transactionId,
        responseData: data,
        correlationId,
      });
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Check transaction status
    if (tx.result !== 'SUCCESS') {
      return NextResponse.json(
        { error: `Transaction failed with status: ${tx.result}` },
        { status: 400 }
      );
    }

    // Extract memo
    const memo = tx.memo_base64
      ? Buffer.from(tx.memo_base64, 'base64').toString('utf-8')
      : undefined;

    // Verify memo contains payment link ID
    if (!memo || !memo.includes(validated.paymentLinkId)) {
      return NextResponse.json(
        { 
          error: 'Transaction memo does not match this payment link',
          transactionMemo: memo,
          expectedPaymentLinkId: validated.paymentLinkId,
        },
        { status: 400 }
      );
    }

    // Determine token type from transaction
    let tokenType: TokenType;
    let amount: number;
    let sender: string;
    let recipient: string;

    // Check for HBAR transfer
    const hbarTransfer = tx.transfers?.find((t) => t.amount > 0 && !t.is_approval);
    if (hbarTransfer && hbarTransfer.amount > 0) {
      tokenType = 'HBAR';
      amount = fromSmallestUnit(hbarTransfer.amount, 'HBAR');
      recipient = hbarTransfer.account;
      const senderTransfer = tx.transfers?.find((t) => t.amount < 0);
      sender = senderTransfer?.account || 'unknown';
    } else {
      // Check for token transfers (USDC, USDT, AUDD)
      const tokenTransfer = tx.token_transfers?.find((t) => t.amount > 0 && !t.is_approval);
      if (!tokenTransfer) {
        return NextResponse.json(
          { error: 'No valid transfer found in transaction' },
          { status: 400 }
        );
      }

      recipient = tokenTransfer.account;
      const tokenId = tokenTransfer.token_id;

      // Determine token type from token ID
      const usdcId = TOKEN_CONFIG.USDC.id;
      const usdtId = TOKEN_CONFIG.USDT.id;
      const auddId = TOKEN_CONFIG.AUDD.id;

      if (tokenId === usdcId) {
        tokenType = 'USDC';
        amount = fromSmallestUnit(tokenTransfer.amount, 'USDC');
      } else if (tokenId === usdtId) {
        tokenType = 'USDT';
        amount = fromSmallestUnit(tokenTransfer.amount, 'USDT');
      } else if (tokenId === auddId) {
        tokenType = 'AUDD';
        amount = fromSmallestUnit(tokenTransfer.amount, 'AUDD');
      } else {
        return NextResponse.json(
          { error: `Unknown token ID: ${tokenId}` },
          { status: 400 }
        );
      }

      const senderTransfer = tx.token_transfers?.find(
        (t) => t.token_id === tokenId && t.amount < 0
      );
      sender = senderTransfer?.account || 'unknown';
    }

    loggers.hedera.info('Transaction details extracted', {
      transactionId: validated.transactionId,
      tokenType,
      amount,
      sender,
      recipient,
      memo,
    });

    // Get or create ledger accounts
    const ledgerAccounts = await ensureLedgerAccounts(
      paymentLink.organization_id,
      tokenType
    );

    const now = new Date();
    // Use correlation_id as base for idempotency keys
    const idempotencyKey = correlationId;

    // mirrorUrl is already declared at line 119, reuse it for metadata
    // Update payment link and create records
    await prisma.$transaction([
      // 1. Update payment link status
      prisma.payment_links.update({
        where: { id: validated.paymentLinkId },
        data: {
          status: 'PAID',
          updated_at: now,
        },
      }),

      // 2. Create payment event
      prisma.payment_events.create({
        data: {
          payment_link_id: validated.paymentLinkId,
          event_type: 'PAYMENT_CONFIRMED',
          payment_method: 'HEDERA',
          hedera_transaction_id: validated.transactionId,
          amount_received: amount.toString(),
          currency_received: tokenType,
          correlation_id: correlationId,
          metadata: {
            transactionId: validated.transactionId,
            amount: amount.toString(),
            tokenType,
            sender,
            recipient,
            consensus_timestamp: tx.consensus_timestamp,
            memo,
            network: validated.network,
            mirror_url: mirrorUrl,
            payer_account_id: sender,
            merchant_account_id: recipient,
            manuallyVerified: true,
          },
        },
      }),

      // 3. Create ledger entry: DEBIT Crypto Clearing
      prisma.ledger_entries.create({
        data: {
          payment_link_id: validated.paymentLinkId,
          ledger_account_id: ledgerAccounts.cryptoClearing,
          entry_type: 'DEBIT',
          amount: paymentLink.amount,
          currency: paymentLink.currency,
          description: `${tokenType} payment received - ${validated.transactionId} (manual verification)`,
          idempotency_key: `${idempotencyKey}-debit`,
          created_at: now,
        },
      }),

      // 4. Create ledger entry: CREDIT Accounts Receivable
      prisma.ledger_entries.create({
        data: {
          payment_link_id: validated.paymentLinkId,
          ledger_account_id: ledgerAccounts.accountsReceivable,
          entry_type: 'CREDIT',
          amount: paymentLink.amount,
          currency: paymentLink.currency,
          description: `${tokenType} payment received - ${validated.transactionId} (manual verification)`,
          idempotency_key: `${idempotencyKey}-credit`,
          created_at: now,
        },
      }),
    ]);

    const duration = Date.now() - startTime;

    loggers.hedera.info('Payment manually verified and persisted', {
      paymentLinkId: validated.paymentLinkId,
      transactionId: validated.transactionId,
      correlationId,
      amount,
      tokenType,
      sender,
      duration,
    });

    return NextResponse.json({
      success: true,
      message: 'Payment verified and processed successfully',
      correlationId,
      transaction: {
        id: validated.transactionId,
        tokenType,
        amount: amount.toString(),
        sender,
        recipient,
        timestamp: tx.consensus_timestamp,
        memo,
      },
      paymentLink: {
        id: validated.paymentLinkId,
        status: 'PAID',
      },
      duration,
    });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;

    if (error instanceof z.ZodError) {
      loggers.hedera.warn('Invalid verification request', {
        errors: error.issues,
        duration,
      });
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    loggers.hedera.error('Manual verification failed', {
      error: errorMessage,
      duration,
    });

    return NextResponse.json(
      { error: 'Failed to verify transaction', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Ensure ledger accounts exist for the organization (idempotent)
 */
async function ensureLedgerAccounts(
  organizationId: string,
  tokenType: TokenType
): Promise<{ cryptoClearing: string; accountsReceivable: string }> {
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

  return {
    cryptoClearing: cryptoAccount.id,
    accountsReceivable: arAccount.id,
  };
}

