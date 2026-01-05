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
import { prisma } from '@/lib/server/prisma';

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

/**
 * Redact sensitive information from request body for logging
 */
function redactSensitiveData(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  
  const redacted = { ...(body as Record<string, unknown>) };
  const sensitiveKeys = ['secret', 'password', 'token', 'key', 'apiKey', 'privateKey'];
  
  for (const key of Object.keys(redacted)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      redacted[key] = '[REDACTED]';
    }
  }
  
  return redacted;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let rawBody: unknown = null;
  
  try {
    // Parse request body
    rawBody = await request.json();
    
    // Validate input with Zod
    const validated = requestSchema.parse(rawBody);

    loggers.hedera.info(
      'Transaction check requested',
      {
        paymentLinkId: validated.paymentLinkId,
        merchantAccountId: validated.merchantAccountId,
        tokenType: validated.tokenType,
        expectedAmount: validated.expectedAmount,
      }
    );

    // Check if payment link exists and get its current status
    const paymentLink = await prisma.payment_links.findUnique({
      where: { id: validated.paymentLinkId },
      select: { id: true, status: true },
    });

    if (!paymentLink) {
      const duration = Date.now() - startTime;
      loggers.hedera.warn(
        'Payment link not found',
        { paymentLinkId: validated.paymentLinkId, duration }
      );
      
      return NextResponse.json(
        {
          error: 'payment_link_not_found',
          message: 'The specified payment link does not exist',
        },
        { status: 404 }
      );
    }

    // If already paid, return success without checking again
    if (paymentLink.status === 'PAID') {
      const duration = Date.now() - startTime;
      loggers.hedera.info(
        'Payment link already paid',
        { paymentLinkId: validated.paymentLinkId, duration }
      );
      
      return NextResponse.json({
        found: true,
        alreadyPaid: true,
        duration,
      });
    }

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
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    
    // Handle validation errors
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      const fieldName = firstIssue.path.join('.');
      
      // Determine specific error code based on field
      let errorCode = 'invalid_input';
      let message = 'Invalid request data';
      
      if (fieldName === 'paymentLinkId') {
        errorCode = 'invalid_payment_link_id';
        message = 'Payment link ID must be a valid UUID';
      } else if (fieldName === 'network') {
        errorCode = 'invalid_network';
        message = 'Network must be either "testnet" or "mainnet"';
      } else if (fieldName === 'merchantAccountId') {
        errorCode = 'invalid_merchant_account_id';
        message = 'Merchant account ID must be in format "0.0.x"';
      } else if (fieldName === 'payerAccountId') {
        errorCode = 'invalid_payer_account_id';
        message = 'Payer account ID must be in format "0.0.x"';
      }
      
      loggers.hedera.warn(
        'Invalid request data',
        {
          errorCode,
          field: fieldName,
          requestBody: redactSensitiveData(rawBody),
          errors: error.issues,
          duration,
        }
      );
      
      return NextResponse.json(
        {
          error: errorCode,
          message,
          ...(process.env.NODE_ENV !== 'production' && { details: error.issues }),
        },
        { status: 400 }
      );
    }

    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      loggers.hedera.warn(
        'Invalid JSON in request body',
        { errorMessage: error.message, duration }
      );
      
      return NextResponse.json(
        {
          error: 'invalid_json',
          message: 'Request body must be valid JSON',
        },
        { status: 400 }
      );
    }

    // Handle all other errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorCode = (error as { code?: string }).code;
    
    loggers.hedera.error(
      'Transaction monitoring failed',
      error instanceof Error ? error : new Error(String(error)),
      {
        requestBody: redactSensitiveData(rawBody),
        duration,
        errorName,
        errorCode,
      }
    );
    
    return NextResponse.json(
      {
        error: 'monitor_failed',
        message: 'Failed to monitor transaction. Please try again.',
        ...(process.env.NODE_ENV !== 'production' && {
          details: {
            message: errorMessage,
            name: errorName,
          },
        }),
      },
      { status: 500 }
    );
  }
}












