import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth/admin.server';
import { processQueue } from '@/lib/xero/queue-processor';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/pilot/xero-replay?batchSize=10
 * Admin-only: drain Xero retry queue for pilot launch.
 */
export async function POST(request: NextRequest) {
  const admin = await checkAdminAuth();
  if (!admin.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const batchSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('batchSize') || '10', 10))
  );

  logger.info({ batchSize, userEmail: admin.userEmail }, 'Pilot Xero replay queue triggered');

  const stats = await processQueue(batchSize);

  return NextResponse.json({ success: true, stats });
}
