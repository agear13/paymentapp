import { prisma } from '@/lib/server/prisma';
import { validateLedgerInvariant } from '@/lib/ledger/invariant-checker';
import { log } from '@/lib/logger';

export interface IntegrityCheckIssue {
  type: string;
  severity: 'warning' | 'critical';
  paymentLinkId?: string;
  paymentEventId?: string;
  xeroSyncId?: string;
  details: Record<string, unknown>;
}

export interface IntegrityCheckResult {
  checkedAt: string;
  settlementIssues: IntegrityCheckIssue[];
  ledgerIssues: IntegrityCheckIssue[];
  xeroIssues: IntegrityCheckIssue[];
  reconciliationIssues: IntegrityCheckIssue[];
  duplicateRisks: IntegrityCheckIssue[];
}

const STUCK_OPEN_STRIPE_MINUTES = 30;
const XERO_FAILED_RETRY_THRESHOLD = 3;
const INTEGRITY_INVARIANT_LINK_LIMIT = 250;

export async function runIntegrityChecks(): Promise<IntegrityCheckResult> {
  const startedAt = Date.now();
  const settlementIssues: IntegrityCheckIssue[] = [];
  const ledgerIssues: IntegrityCheckIssue[] = [];
  const xeroIssues: IntegrityCheckIssue[] = [];
  const reconciliationIssues: IntegrityCheckIssue[] = [];
  const duplicateRisks: IntegrityCheckIssue[] = [];

  const [
    openWithConfirmed,
    paidWithoutConfirmed,
    confirmedEvents,
    xeroRows,
    duplicateConfirmed,
    stuckOpenStripe,
    highRetryXero,
  ] = await Promise.all([
    prisma.payment_links.findMany({
      where: { status: 'OPEN', payment_events: { some: { event_type: 'PAYMENT_CONFIRMED' } } },
      select: { id: true, status: true },
      take: 200,
    }),
    prisma.payment_links.findMany({
      where: { status: 'PAID', payment_events: { none: { event_type: 'PAYMENT_CONFIRMED' } } },
      select: { id: true, status: true },
      take: 200,
    }),
    prisma.payment_events.findMany({
      where: { event_type: 'PAYMENT_CONFIRMED' },
      select: { id: true, payment_link_id: true, created_at: true, metadata: true },
      orderBy: { created_at: 'desc' },
      take: 500,
    }),
    prisma.xero_syncs.findMany({
      select: { id: true, payment_link_id: true, status: true, sync_type: true, retry_count: true },
      take: 500,
    }),
    prisma.payment_events.groupBy({
      by: ['payment_link_id'],
      where: { event_type: 'PAYMENT_CONFIRMED', payment_link_id: { not: null } },
      _count: { _all: true },
      having: { payment_link_id: { _count: { gt: 1 } } },
    }),
    prisma.payment_links.findMany({
      where: {
        status: 'OPEN',
        payment_method: 'STRIPE',
        created_at: { lt: new Date(Date.now() - STUCK_OPEN_STRIPE_MINUTES * 60 * 1000) },
      },
      select: { id: true, created_at: true },
      take: 200,
    }),
    prisma.xero_syncs.findMany({
      where: { status: 'FAILED', retry_count: { gt: XERO_FAILED_RETRY_THRESHOLD } },
      select: { id: true, payment_link_id: true, retry_count: true, status: true },
      take: 200,
    }),
  ]);

  for (const link of openWithConfirmed) {
    settlementIssues.push({
      type: 'OPEN_WITH_PAYMENT_CONFIRMED',
      severity: 'critical',
      paymentLinkId: link.id,
      details: { status: link.status },
    });
  }

  for (const link of paidWithoutConfirmed) {
    settlementIssues.push({
      type: 'PAID_WITHOUT_PAYMENT_CONFIRMED',
      severity: 'critical',
      paymentLinkId: link.id,
      details: { status: link.status },
    });
  }

  const xeroByLink = new Map<string, { id: string; status: string; sync_type: string }[]>();
  for (const x of xeroRows) {
    const arr = xeroByLink.get(x.payment_link_id) ?? [];
    arr.push({ id: x.id, status: x.status, sync_type: x.sync_type });
    xeroByLink.set(x.payment_link_id, arr);
  }

  const confirmedLinkIds = Array.from(
    new Set(
      confirmedEvents
        .map((x) => x.payment_link_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const ledgerCounts = await prisma.ledger_entries.groupBy({
    by: ['payment_link_id'],
    where: { payment_link_id: { in: confirmedLinkIds } },
    _count: { _all: true },
  });
  const ledgerCountByLink = new Map<string, number>(
    ledgerCounts.map((x) => [x.payment_link_id, x._count._all])
  );

  for (const pe of confirmedEvents) {
    if (!pe.payment_link_id) continue;
    const ledgerCount = ledgerCountByLink.get(pe.payment_link_id) ?? 0;
    if (ledgerCount === 0) {
      ledgerIssues.push({
        type: 'PAYMENT_CONFIRMED_WITHOUT_LEDGER',
        severity: 'critical',
        paymentLinkId: pe.payment_link_id,
        paymentEventId: pe.id,
        details: {},
      });
    }

    const xero = xeroByLink.get(pe.payment_link_id) ?? [];
    const hasPaymentSync = xero.some((r) => r.sync_type === 'PAYMENT');
    if (!hasPaymentSync) {
      xeroIssues.push({
        type: 'PAYMENT_CONFIRMED_WITHOUT_XERO_SYNC',
        severity: 'warning',
        paymentLinkId: pe.payment_link_id,
        paymentEventId: pe.id,
        details: {},
      });
    }

  }

  const invariantTargets = confirmedLinkIds.slice(0, INTEGRITY_INVARIANT_LINK_LIMIT);
  for (const linkId of invariantTargets) {
    const invariantRows = await validateLedgerInvariant(linkId);
    for (const row of invariantRows) {
      if (!row.balanced) {
        ledgerIssues.push({
          type: 'LEDGER_IMBALANCE',
          severity: 'critical',
          paymentLinkId: row.paymentLinkId,
          details: {
            currency: row.currency,
            debitTotal: row.debitTotal,
            creditTotal: row.creditTotal,
            difference: row.difference,
          },
        });
      }
    }
  }

  const successXeroLinkIds = Array.from(
    new Set(xeroRows.filter((x) => x.status === 'SUCCESS').map((x) => x.payment_link_id))
  );
  const confirmedForXero = successXeroLinkIds.length
    ? await prisma.payment_events.findMany({
        where: {
          payment_link_id: { in: successXeroLinkIds },
          event_type: 'PAYMENT_CONFIRMED',
        },
        select: { payment_link_id: true },
        distinct: ['payment_link_id'],
      })
    : [];
  const confirmedXeroSet = new Set(confirmedForXero.map((x) => x.payment_link_id).filter(Boolean));

  for (const x of xeroRows) {
    if (x.status !== 'SUCCESS') continue;
    if (!confirmedXeroSet.has(x.payment_link_id)) {
      xeroIssues.push({
        type: 'XERO_SUCCESS_WITHOUT_PAYMENT_CONFIRMED',
        severity: 'critical',
        paymentLinkId: x.payment_link_id,
        xeroSyncId: x.id,
        details: { syncType: x.sync_type },
      });
    }
  }

  for (const dup of duplicateConfirmed) {
    duplicateRisks.push({
      type: 'DUPLICATE_PAYMENT_CONFIRMED',
      severity: 'critical',
      paymentLinkId: dup.payment_link_id ?? undefined,
      details: { duplicateCount: dup._count._all },
    });
  }

  for (const link of stuckOpenStripe) {
    reconciliationIssues.push({
      type: 'STUCK_OPEN_STRIPE',
      severity: 'warning',
      paymentLinkId: link.id,
      details: { createdAt: link.created_at.toISOString() },
    });
  }

  // "Hedera tx verified but no settlement event" heuristic:
  // look for hedera PAYMENT_INITIATED/PENDING events older than 10m without PAYMENT_CONFIRMED.
  const staleHederaPending = await prisma.payment_events.findMany({
    where: {
      payment_method: 'HEDERA',
      event_type: { in: ['PAYMENT_INITIATED', 'PAYMENT_PENDING'] },
      created_at: { lt: new Date(Date.now() - 10 * 60 * 1000) },
    },
    select: { payment_link_id: true, id: true, metadata: true, created_at: true },
    take: 200,
  });
  const stalePendingLinkIds = Array.from(
    new Set(staleHederaPending.map((p) => p.payment_link_id).filter((id): id is string => Boolean(id)))
  );
  const stalePendingConfirmed = stalePendingLinkIds.length
    ? await prisma.payment_events.findMany({
        where: {
          payment_link_id: { in: stalePendingLinkIds },
          event_type: 'PAYMENT_CONFIRMED',
        },
        select: { payment_link_id: true },
        distinct: ['payment_link_id'],
      })
    : [];
  const stalePendingConfirmedSet = new Set(stalePendingConfirmed.map((x) => x.payment_link_id).filter(Boolean));

  for (const p of staleHederaPending) {
    if (!p.payment_link_id) continue;
    if (!stalePendingConfirmedSet.has(p.payment_link_id)) {
      reconciliationIssues.push({
        type: 'HEDERA_VERIFIED_NO_SETTLEMENT',
        severity: 'warning',
        paymentLinkId: p.payment_link_id,
        paymentEventId: p.id,
        details: { pendingSince: p.created_at.toISOString(), metadata: p.metadata },
      });
    }
  }

  for (const x of highRetryXero) {
    xeroIssues.push({
      type: 'XERO_FAILED_HIGH_RETRY',
      severity: 'warning',
      paymentLinkId: x.payment_link_id,
      xeroSyncId: x.id,
      details: { retryCount: x.retry_count, status: x.status },
    });
  }

  const durationMs = Date.now() - startedAt;
  if (durationMs > 15_000) {
    log.warn('[integrity-checks] heavy scan duration', {
      durationMs,
      confirmedEvents: confirmedEvents.length,
      confirmedLinkIds: confirmedLinkIds.length,
      invariantTargets: invariantTargets.length,
    });
  }

  return {
    checkedAt: new Date().toISOString(),
    settlementIssues,
    ledgerIssues,
    xeroIssues,
    reconciliationIssues,
    duplicateRisks,
  };
}

