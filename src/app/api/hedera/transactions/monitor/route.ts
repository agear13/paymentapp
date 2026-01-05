/**
 * POST /api/hedera/transactions/monitor
 * Check for incoming payment transaction (fast, non-blocking)
 * Performs ONE bounded query, returns immediately
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkForTransaction } from '@/lib/hedera/transaction-checker';
import { loggers } from '@/lib/logger';
import type { TokenType } from '@/lib/hedera/constants';

const requestSchema = z.object({
  paymentLinkId: z.string().uuid(),
  merchantAccountId: z.string().regex(/^0\.0\.\d+$/),
  payerAccountId: z.string().regex(/^0\.0\.\d+$/).optional(),
  network: z.enum(['testnet', 'mainnet']),
  tokenType: z.enum(['HBAR', 'USDC', 'USDT', 'AUDD']),
  expectedAmount: z.union([z.number(), z.string()]).transform((val) => 
    typeof val === 'string' ? parseFloat(val) : val
  ),
  memo: z.string().optional(),
  timeWindowMinutes: z.number().positive().optional().default(15),
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const validated = requestSchema.parse(body);

    loggers.hedera.info(
      'Transaction check requested',
      {
        paymentLinkId: validated.paymentLinkId,
        merchantAccountId: validated.merchantAccountId,
        tokenType: validated.tokenType,
        expectedAmount: validated.expectedAmount,
      }
    );

    // Check for transaction (fast, non-blocking, max 8 seconds)
    const result = await checkForTransaction({
      paymentLinkId: validated.paymentLinkId,
      merchantAccountId: validated.merchantAccountId,
      payerAccountId: validated.payerAccountId,
      network: validated.network,
      tokenType: validated.tokenType as TokenType,
      expectedAmount: validated.expectedAmount,
      memo: validated.memo,
      timeWindowMinutes: validated.timeWindowMinutes,
    });

    const duration = Date.now() - startTime;
    
    if (result.found) {
      loggers.hedera.info(
        'Transaction found',
        {
          paymentLinkId: validated.paymentLinkId,
          transactionId: result.transactionId,
          duration,
        }
      );

      return NextResponse.json({
        found: true,
        transactionId: result.transactionId,
        amount: result.amount,
        sender: result.sender,
        timestamp: result.timestamp,
        updated: result.updated,
        duration,
      });
    }

    loggers.hedera.info(
      'Transaction not found',
      { paymentLinkId: validated.paymentLinkId, duration }
    );

    return NextResponse.json({
      found: false,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error instanceof z.ZodError) {
      loggers.hedera.warn('Invalid request data', { errors: error.issues, duration });
      return NextResponse.json(
        {
          found: false,
          error: 'Invalid request data',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    loggers.hedera.error('Transaction check failed', { error, duration });
    return NextResponse.json(
      {
        found: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}












