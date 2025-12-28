/**
 * GET /api/hedera/transactions/[transactionId]
 * Get transaction details by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTransaction } from '@/lib/hedera/transaction-monitor';
import { log } from '@/lib/logger';
import { handleApiError } from '@/lib/api/middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params;

    log.info({ transactionId }, 'Fetching transaction details');

    const transaction = await getTransaction(transactionId);

    if (!transaction) {
      return NextResponse.json(
        {
          success: false,
          error: 'Transaction not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        transaction,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch transaction');
  }
}












