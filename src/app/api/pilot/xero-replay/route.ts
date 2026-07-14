import { NextRequest, NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth/api-session.server';
import { processQueue } from '@/lib/xero/queue-processor';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/pilot/xero-replay?batchSize=10
 * Admin-only: drain Xero retry queue for pilot launch.
 */
export async function POST(request: NextRequest) {
  const adminAuth = await requireAdminForApi(request);
  if (!adminAuth.user) return adminAuth.response!;

  const { searchParams } = new URL(request.url);
  const batchSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('batchSize') || '10', 10))
  );

  logger.info(
    { batchSize, userEmail: adminAuth.user.email },
    'Pilot Xero replay queue triggered'
  );

  const stats = await processQueue(batchSize);

  return NextResponse.json({ success: true, stats });
}
