import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth/admin.server';
import { runIntegrityChecks } from '@/lib/payments/integrity-checks';
import { loggers } from '@/lib/logger';
import { acquireJobLease, releaseJobLease } from '@/lib/jobs/job-lease';

function isAuthorizedBySecret(request: NextRequest): boolean {
  const auth = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  return !!expected && auth === `Bearer ${expected}`;
}

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
      jobName: 'system-integrity',
      leaseTtlSeconds:
        Number.parseInt(process.env.SYSTEM_INTEGRITY_LEASE_TTL_SECONDS || '600', 10) || 600,
    });
    if (!lease.acquired) {
      return NextResponse.json({ skipped: true, reason: 'lease_active' }, { status: 200 });
    }
    leaseOwnerId = lease.ownerId;

    const result = await runIntegrityChecks();
    return NextResponse.json({
      settlementIssues: result.settlementIssues,
      ledgerIssues: result.ledgerIssues,
      xeroIssues: result.xeroIssues,
      reconciliationIssues: result.reconciliationIssues,
      duplicateRisks: result.duplicateRisks,
      checkedAt: result.checkedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    loggers.api.error('System integrity route failed', new Error(message));
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (leaseOwnerId) {
      await releaseJobLease({ jobName: 'system-integrity', ownerId: leaseOwnerId });
    }
  }
}

