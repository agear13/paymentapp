/**
 * Hedera Payment Confirmation Endpoint
 * POST /api/hedera/confirm
 * 
 * Confirms a Hedera payment after transaction is detected
 * Verifies transaction via mirror node and processes payment atomically
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { log } from '@/lib/logger';
import { confirmPayment } from '@/lib/services/payment-confirmation';
import { generateCorrelationId } from '@/lib/services/correlation';
import { getTransaction, isTransactionConfirmed } from '@/lib/hedera/transaction-monitor';
import { prisma } from '@/lib/server/prisma';
import { getPaidAtForPaymentLink } from '@/lib/payments/paid-at';
import config from '@/lib/config/env';

// Request validation schema
const confirmRequestSchema = z.object({
  paymentLinkId: z.string().uuid(),
  txId: z.string().min(1),
  token: z.enum(['HBAR', 'USDC', 'USDT', 'AUDD']),
});

export async function POST(request: NextRequest) {
  const correlationId = generateCorrelationId('hedera', `confirm_${Date.now()}`);
  
  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = confirmRequestSchema.safeParse(body);

    if (!validation.success) {
      log.warn({
        correlationId,
        errors: validation.error.errors,
      }, 'Invalid request body');

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { paymentLinkId, txId, token } = validation.data;

    log.info({
      correlationId,
      paymentLinkId,
      txId,
      token,
    }, 'Processing Hedera payment confirmation');

    // 1. Get payment link and validate
    const paymentLink = await prisma.payment_links.findUnique({
      where: { id: paymentLinkId },
      include: {
        organizations: {
          include: {
            merchant_settings: true,
          },
        },
      },
    });

    if (!paymentLink) {
      return NextResponse.json(
        { success: false, error: 'Payment link not found' },
        { status: 404 }
      );
    }

    if (paymentLink.status === 'PAID') {
      log.info({
        correlationId,
        paymentLinkId,
      }, 'Payment link already paid');

      const paidAt = await getPaidAtForPaymentLink(prisma, paymentLink.id);
      return NextResponse.json({
        success: true,
        alreadyPaid: true,
        paymentLink: {
          id: paymentLink.id,
          status: paymentLink.status,
          paid_at: paidAt ? paidAt.toISOString() : null,
        },
      });
    }

    if (paymentLink.status !== 'OPEN') {
      return NextResponse.json(
        {
          success: false,
          error: `Payment link status is ${paymentLink.status}, expected OPEN`,
        },
        { status: 400 }
      );
    }

    // 2. Get merchant Hedera account
    const merchantSettings = paymentLink.organizations.merchant_settings;
    if (!merchantSettings?.hedera_account_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Merchant Hedera account not configured',
        },
        { status: 400 }
      );
    }

    const merchantAccountId = merchantSettings.hedera_account_id;

    log.info({
      correlationId,
      txId,
      merchantAccountId,
    }, 'Verifying transaction on mirror node');

    // 3. Get transaction from mirror node
    const transaction = await getTransaction(txId);

    if (!transaction) {
      log.warn({
        correlationId,
        txId,
      }, 'Transaction not found on mirror node');

      return NextResponse.json(
        {
          success: false,
          error: 'Transaction not found on Hedera network',
          details: 'Transaction may not be confirmed yet or TX ID is invalid',
        },
        { status: 404 }
      );
    }

    // 4. Verify transaction is confirmed
    if (!isTransactionConfirmed(transaction)) {
      log.warn({
        correlationId,
        txId,
        result: transaction.result,
      }, 'Transaction not yet confirmed');

      return NextResponse.json(
        {
          success: false,
          error: 'Transaction not yet confirmed',
          details: `Transaction result: ${transaction.result}`,
        },
        { status: 400 }
      );
    }

    // 5. Extract and validate transfer amount
    let amountReceived = 0;
    let actualToken = token;

    if (token === 'HBAR') {
      // Find HBAR transfer to merchant
      const transfer = transaction.transfers?.find(
        (t) => t.account === merchantAccountId && Number(t.amount) > 0
      );

      if (!transfer) {
        return NextResponse.json(
          {
            success: false,
            error: 'No HBAR transfer found to merchant account',
          },
          { status: 400 }
        );
      }

      // Convert tinybars to HBAR
      amountReceived = Number(transfer.amount) / 100_000_000;
    } else {
      // Token transfer
      const tokenId = config.hedera.tokens[token.toLowerCase() as keyof typeof config.hedera.tokens];
      
      if (!tokenId) {
        return NextResponse.json(
          {
            success: false,
            error: `Token ${token} not configured`,
          },
          { status: 400 }
        );
      }

      const tokenTransfer = transaction.token_transfers?.find(
        (tt) =>
          tt.token_id === tokenId &&
          tt.account === merchantAccountId &&
          Number(tt.amount) > 0
      );

      if (!tokenTransfer) {
        return NextResponse.json(
          {
            success: false,
            error: `No ${token} transfer found to merchant account`,
          },
          { status: 400 }
        );
      }

      // Token amount (assuming 6 decimals for stablecoins, 8 for others)
      const decimals = ['USDC', 'USDT'].includes(token) ? 6 : 8;
      amountReceived = Number(tokenTransfer.amount) / Math.pow(10, decimals);
    }

    log.info({
      correlationId,
      txId,
      token,
      amountReceived,
      expectedAmount: paymentLink.amount,
    }, 'Transaction verified');

    // 6. Validate amount (with tolerance)
    const expectedAmount = Number(paymentLink.amount);
    const tolerance = 0.02; // 2% tolerance
    const minAmount = expectedAmount * (1 - tolerance);
    const maxAmount = expectedAmount * (1 + tolerance);

    if (amountReceived < minAmount || amountReceived > maxAmount) {
      log.warn({
        correlationId,
        amountReceived,
        expectedAmount,
        minAmount,
        maxAmount,
      }, 'Amount outside tolerance range');

      return NextResponse.json(
        {
          success: false,
          error: 'Payment amount outside acceptable range',
          details: {
            received: amountReceived,
            expected: expectedAmount,
            tolerance: `${tolerance * 100}%`,
          },
        },
        { status: 400 }
      );
    }

    // 7. Confirm payment using unified service
    const confirmResult = await confirmPayment({
      paymentLinkId,
      provider: 'hedera',
      providerRef: txId,
      transactionId: txId,
      amountReceived,
      currencyReceived: token,
      tokenType: token,
      correlationId,
      metadata: {
        consensus_timestamp: transaction.consensus_timestamp,
        charged_tx_fee: transaction.charged_tx_fee,
        sender: transaction.transfers?.[0]?.account,
        memo: transaction.memo_base64,
      },
    });

    if (!confirmResult.success) {
      log.error({
        correlationId,
        error: confirmResult.error,
      }, 'Payment confirmation failed');

      return NextResponse.json(
        {
          success: false,
          error: confirmResult.error || 'Payment confirmation failed',
        },
        { status: 500 }
      );
    }

    // 8. Return success with updated payment link
    const updatedPaymentLink = await prisma.payment_links.findUnique({
      where: { id: paymentLinkId },
    });
    const paidAt = await getPaidAtForPaymentLink(prisma, paymentLinkId);

    log.info({
      correlationId,
      paymentLinkId,
      txId,
      paymentEventId: confirmResult.paymentEventId,
    }, 'Hedera payment confirmed successfully');

    return NextResponse.json({
      success: true,
      persisted: true,
      alreadyProcessed: confirmResult.alreadyProcessed,
      transactionId: txId,
      paymentLink: {
        id: updatedPaymentLink?.id,
        status: updatedPaymentLink?.status,
        paid_at: paidAt ? paidAt.toISOString() : null,
      },
      paymentEventId: confirmResult.paymentEventId,
    });
  } catch (error: any) {
    log.error({
      correlationId,
      error: error.message,
      stack: error.stack,
    }, 'Hedera confirmation endpoint error');

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

