import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { validateLedgerInvariant } from '@/lib/ledger/invariant-checker';
import { acquireJobLease, releaseJobLease, renewJobLease } from '@/lib/jobs/job-lease';

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const leaseTtlSeconds =
    Number.parseInt(process.env.LEDGER_INTEGRITY_LEASE_TTL_SECONDS || '900', 10) || 900;
  const chunkSize =
    Number.parseInt(process.env.LEDGER_INTEGRITY_CHUNK_SIZE || '100', 10) || 100;

  const lease = await acquireJobLease({
    jobName: 'ledger-integrity',
    leaseTtlSeconds,
  });
  if (!lease.acquired) {
    return NextResponse.json(
      { success: true, skipped: true, reason: 'lease_active' },
      { status: 200 }
    );
  }

  try {
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
    }
    if (cronSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const settled = await prisma.payment_events.findMany({
      where: {
        event_type: 'PAYMENT_CONFIRMED',
        payment_link_id: { not: null },
        created_at: { gte: since },
      },
      select: { payment_link_id: true, id: true },
      orderBy: { created_at: 'desc' },
      take: Number.parseInt(process.env.LEDGER_INTEGRITY_MAX_LINKS || '500', 10) || 500,
    });

    const ids = Array.from(
      new Set(
        settled
          .map((e) => e.payment_link_id)
          .filter((id): id is string => !!id)
      )
    );
    if (ids.length > chunkSize * 3) {
      loggers.jobs.warn('Ledger integrity scan size is high', {
        paymentLinkCount: ids.length,
        chunkSize,
      });
    }

    const violations: Array<{
      paymentLinkId: string;
      currency: string;
      debitTotal: string;
      creditTotal: string;
      difference: string;
    }> = [];

    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      await renewJobLease({ jobName: 'ledger-integrity', ownerId: lease.ownerId, leaseTtlSeconds });
      for (const paymentLinkId of chunk) {
        const results = await validateLedgerInvariant(paymentLinkId);
        for (const r of results) {
          if (!r.balanced) {
            violations.push({
              paymentLinkId: r.paymentLinkId,
              currency: r.currency,
              debitTotal: r.debitTotal,
              creditTotal: r.creditTotal,
              difference: r.difference,
            });
          }
        }
      }
    }

    if (violations.length > 0) {
      loggers.jobs.error('Ledger integrity violations detected', undefined, {
        count: violations.length,
        violations,
      });
    } else {
      loggers.jobs.info('Ledger integrity check passed', {
        scannedPaymentLinks: ids.length,
      });
    }

    return NextResponse.json({
      success: violations.length === 0,
      scannedPaymentLinks: ids.length,
      violations,
      durationMs: Date.now() - startedAt,
      chunkSize,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    loggers.jobs.error('Ledger integrity job failed', new Error(message));
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await releaseJobLease({ jobName: 'ledger-integrity', ownerId: lease.ownerId });
  }
}

