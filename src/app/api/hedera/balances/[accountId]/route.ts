/**
 * GET /api/hedera/balances/[accountId]
 * Fetch token balances for a Hedera account
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAccountBalances } from '@/lib/hedera/token-service';
import { log } from '@/lib/logger';
import { handleApiError } from '@/lib/api/middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;

    log.info({ accountId }, 'Fetching account balances');

    // Validate account ID format (basic validation)
    if (!accountId || !accountId.match(/^0\.0\.\d+$/)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid account ID format. Expected format: 0.0.12345',
        },
        { status: 400 }
      );
    }

    const balances = await getAccountBalances(accountId);

    return NextResponse.json({
      success: true,
      data: {
        accountId,
        balances,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch account balances');
  }
}












