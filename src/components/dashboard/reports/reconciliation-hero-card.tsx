'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { formatReportDateTime } from '@/lib/format/format-report-datetime';
import { formatCurrency } from '@/lib/formatters/format-currency';
import {
  countReconciliationDiscrepancies,
  countReconciledRails,
  countReconciledTransactions,
  getReconciliationHeroHeadline,
  getReconciliationHeroState,
} from '@/lib/reports/reconciliation-display';
import type { ReconciliationReportData } from '@/lib/reports/reconciliation-types';
import { REPORTS_LEDGER_HREF } from '@/lib/navigation/operator-nav';
import { cn } from '@/lib/utils';

interface ReconciliationHeroCardProps {
  organizationId: string;
  reconciliationAnchorId?: string;
}

export function ReconciliationHeroCard({
  organizationId,
  reconciliationAnchorId = 'reconciliation-report',
}: ReconciliationHeroCardProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReconciliationReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchSummary();
  }, [organizationId]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/reports/reconciliation?organizationId=${organizationId}`
      );
      if (!response.ok) throw new Error('Failed to load reconciliation');
      setData((await response.json()) as ReconciliationReportData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reconciliation unavailable');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-20 w-full" />
      </section>
    );
  }

  const heroState = getReconciliationHeroState(data, Boolean(error));
  const discrepancyCount = data ? countReconciliationDiscrepancies(data.report) : 0;
  const headline = getReconciliationHeroHeadline(heroState, discrepancyCount);
  const reconciledRails = data ? countReconciledRails(data.report) : 0;
  const totalRails = data ? Object.keys(data.report).length : 0;
  const transactionCount = data ? countReconciledTransactions(data.report) : 0;

  const stateStyles = {
    reconciled: 'border-emerald-300/80 bg-emerald-50/70 dark:bg-emerald-950/30',
    discrepancy: 'border-red-300/80 bg-red-50/60 dark:bg-red-950/25',
    no_activity: 'border-border bg-muted/30',
    sync_pending: 'border-amber-300/80 bg-amber-50/50 dark:bg-amber-950/20',
  }[heroState];

  const StateIcon = {
    reconciled: CheckCircle2,
    discrepancy: AlertCircle,
    no_activity: Clock,
    sync_pending: RefreshCw,
  }[heroState];

  const iconColor = {
    reconciled: 'text-emerald-700',
    discrepancy: 'text-red-700',
    no_activity: 'text-muted-foreground',
    sync_pending: 'text-amber-700',
  }[heroState];

  return (
    <section
      className={cn(
        'rounded-xl border-2 p-6 shadow-sm transition-colors',
        stateStyles
      )}
      aria-labelledby="reconciliation-hero-title"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3 min-w-0">
          <StateIcon className={cn('h-8 w-8 shrink-0 mt-0.5', iconColor)} aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Reconciliation status
            </p>
            <h2 id="reconciliation-hero-title" className="text-xl font-semibold tracking-tight mt-0.5">
              {headline}
            </h2>
            {heroState === 'no_activity' ? (
              <p className="text-sm text-muted-foreground mt-1">
                Your first payment will automatically appear here once received and posted to the
                ledger.
              </p>
            ) : heroState === 'sync_pending' ? (
              <p className="text-sm text-amber-900 dark:text-amber-200 mt-1">
                {error ?? 'Could not refresh reconciliation. Try again.'}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">
                Ledger clearing balances are compared with confirmed payments for audit-ready
                integrity.
              </p>
            )}
          </div>
        </div>

        {data && heroState !== 'sync_pending' && heroState !== 'no_activity' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm shrink-0">
            {heroState === 'discrepancy' ? (
              <Metric
                label="Total discrepancy"
                value={formatCurrency(data.totalDifference, 'AUD')}
                emphasize
              />
            ) : (
              <Metric label="Total difference" value={formatCurrency(0, 'AUD')} />
            )}
            <Metric label="Rails reconciled" value={`${reconciledRails} / ${totalRails}`} />
            <Metric
              label="Payments reconciled"
              value={String(transactionCount)}
            />
            <Metric
              label="Last updated"
              value={formatReportDateTime(data.timestamp)}
              compact
            />
          </div>
        ) : data && heroState === 'no_activity' ? (
          <Metric label="Last checked" value={formatReportDateTime(data.timestamp)} compact />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/60">
        <Button variant="secondary" size="sm" asChild>
          <Link href={`#${reconciliationAnchorId}`}>
            View reconciliation report
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={REPORTS_LEDGER_HREF}>
            <BookOpen className="mr-1.5 h-3.5 w-3.5" />
            Open ledger
          </Link>
        </Button>
        {heroState === 'discrepancy' ? (
          <Button variant="destructive" size="sm" asChild>
            <Link href={`#${reconciliationAnchorId}`}>Review discrepancies</Link>
          </Button>
        ) : null}
        {heroState === 'sync_pending' ? (
          <Button variant="outline" size="sm" onClick={() => void fetchSummary()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Retry
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  emphasize,
  compact,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  compact?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'font-medium tabular-nums',
          emphasize && 'text-red-700 font-semibold',
          compact && 'text-xs'
        )}
      >
        {value}
      </p>
    </div>
  );
}
