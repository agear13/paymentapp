/**
 * GET /api/hedera/token-associations/[accountId]
 * Check token association status for USDC and USDT
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkTokenAssociations } from '@/lib/hedera/token-service';
import { log } from '@/lib/logger';
import { handleApiError } from '@/lib/api/middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;

    log.info({ accountId }, 'Checking token associations');

    // Validate account ID format
    if (!accountId || !accountId.match(/^0\.0\.\d+$/)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid account ID format. Expected format: 0.0.12345',
        },
        { status: 400 }
      );
    }

    const associations = await checkTokenAssociations(accountId);

    return NextResponse.json({
      success: true,
      data: {
        accountId,
        associations,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error, 'Failed to check token associations');
  }
}












