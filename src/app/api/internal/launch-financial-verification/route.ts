import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth/admin.server';
import { runIntegrityChecks } from '@/lib/payments/integrity-checks';
import { loggers } from '@/lib/logger';
import { acquireJobLease, releaseJobLease } from '@/lib/jobs/job-lease';
import {
  buildRevenueShareMatrixResults,
  formatRevenueShareMatrixLines,
} from '@/lib/verification/revenue-share-matrix';

function isAuthorizedBySecret(request: NextRequest): boolean {
  const auth = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  return !!expected && auth === `Bearer ${expected}`;
}

/**
 * GET /api/internal/launch-financial-verification
 * Operational snapshot: integrity checks + deterministic revenue-share matrix (no writes).
 * Auth: Bearer CRON_SECRET or admin session (same pattern as system-integrity).
 */
export async function GET(request: NextRequest) {
  let leaseOwnerId: string | null = null;
  try {
    let authorized = isAuthorizedBySecret(request);
    if (!authorized) {
      const admin = await checkAdminAuth();
      authorized = !!admin.isAdmin;
    }
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lease = await acquireJobLease({
      jobName: 'launch-financial-verification',
      leaseTtlSeconds:
        Number.parseInt(process.env.LAUNCH_FIN_VERIFICATION_LEASE_TTL_SECONDS || '300', 10) || 300,
    });
    if (!lease.acquired) {
      return NextResponse.json({ skipped: true, reason: 'lease_active' }, { status: 200 });
    }
    leaseOwnerId = lease.ownerId;

    const integrity = await runIntegrityChecks();
    const revenueShareMatrix = buildRevenueShareMatrixResults();
    const revenueShareMatrixText = formatRevenueShareMatrixLines().join('\n');

    return NextResponse.json({
      checkedAt: integrity.checkedAt,
      settlementIssueCount: integrity.settlementIssues.length,
      ledgerIssueCount: integrity.ledgerIssues.length,
      xeroIssueCount: integrity.xeroIssues.length,
      reconciliationIssueCount: integrity.reconciliationIssues.length,
      duplicateRiskCount: integrity.duplicateRisks.length,
      integrity,
      revenueShareMatrix,
      revenueShareMatrixText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    loggers.api.error('Launch financial verification failed', new Error(message));
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (leaseOwnerId) {
      await releaseJobLease({ jobName: 'launch-financial-verification', ownerId: leaseOwnerId });
    }
  }
}
