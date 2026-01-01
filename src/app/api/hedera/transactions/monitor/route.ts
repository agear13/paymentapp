/**
 * POST /api/hedera/transactions/monitor
 * Monitor for incoming payment transaction
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { monitorForPayment } from '@/lib/hedera/transaction-monitor';
import { validatePaymentAmount } from '@/lib/hedera/payment-validator';
import { log } from '@/lib/logger';
import { handleApiError } from '@/lib/api/middleware';
import type { TokenType } from '@/lib/hedera/constants';

const requestSchema = z.object({
  accountId: z.string().regex(/^0\.0\.\d+$/),
  tokenType: z.enum(['HBAR', 'USDC', 'USDT', 'AUDD']),
  expectedAmount: z.number().positive(),
  timeoutMs: z.number().positive().optional().default(300000), // 5 minutes default
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, tokenType, expectedAmount, timeoutMs } =
      requestSchema.parse(body);

    log.info(
      { accountId, tokenType, expectedAmount },
      'Starting payment monitoring'
    );

    // Monitor for payment
    const result = await monitorForPayment(
      accountId,
      tokenType as TokenType,
      expectedAmount,
      timeoutMs
    );

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payment timeout',
          message: 'No matching transaction found within the timeout period',
        },
        { status: 408 }
      );
    }

    // Validate payment amount
    const validation = validatePaymentAmount(
      expectedAmount,
      parseFloat(result.amount),
      tokenType as TokenType
    );

    return NextResponse.json({
      success: true,
      data: {
        transaction: result,
        validation,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return handleApiError(error, 'Failed to monitor payment');
  }
}












