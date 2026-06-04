/**
 * POST /api/hedera/transactions/verify
 * Manually verify a specific transaction by ID (mirror lookup → executeHederaMirrorSettlement).
 * Used when automatic monitoring fails or times out.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { loggers } from '@/lib/logger';
import { executeHederaMirrorSettlement } from '@/lib/hedera/hedera-mirror-settlement.server';

const requestSchema = z.object({
  paymentLinkId: z.string().uuid(),
  transactionId: z.string().regex(/^0\.0\.\d+[@-]\d+\.\d+$/),
  network: z.enum(['testnet', 'mainnet']),
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const validated = requestSchema.parse(body);

    loggers.hedera.info('Manual transaction verification requested', {
      paymentLinkId: validated.paymentLinkId,
      transactionId: validated.transactionId,
      network: validated.network,
    });

    const result = await executeHederaMirrorSettlement({
      paymentLinkId: validated.paymentLinkId,
      transactionId: validated.transactionId,
      network: validated.network,
    });

    const duration = Date.now() - startTime;

    if (!result.success) {
      const status =
        result.error === 'Payment link not found'
          ? 404
          : result.error?.includes('not found') ||
              result.error?.includes('not yet indexed')
            ? 404
            : result.error?.includes('memo does not match') ||
                result.error?.includes('failed with status') ||
                result.error?.includes('No valid transfer') ||
                result.error?.includes('Unknown token')
              ? 400
              : 500;

      return NextResponse.json(
        {
          error:
            status === 404
              ? 'Transaction not found on Hedera network after retries'
              : result.error || 'Failed to verify transaction',
          details: result.error,
        },
        { status }
      );
    }

    if (result.alreadyProcessed) {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        message: 'Transaction already verified and processed',
        paymentEventId: result.paymentEventId,
        correlationId: result.correlationId,
        duration,
      });
    }

    const details = result.settlementDetails;

    return NextResponse.json({
      success: true,
      message: 'Payment verified and processed successfully',
      correlationId: result.correlationId,
      paymentEventId: result.paymentEventId,
      transaction: details
        ? {
            id: validated.transactionId,
            tokenType: details.tokenType,
            amount: details.amount.toString(),
            sender: details.sender,
            recipient: details.recipient,
            timestamp: details.consensusTimestamp,
            memo: details.memo,
          }
        : undefined,
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
