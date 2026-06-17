'use client';

/**
 * Commercial Insights — operational intelligence panel.
 *
 * Shown instead of workflow guidance once a workspace becomes operational.
 *
 * Provvy gradually transforms from onboarding manager into operations manager.
 *
 *   Preparation phase  → Lots of guidance. Lots of explanation.
 *   Operational phase  → Insights, revenue, settlement status.
 *   Growth phase       → Trend detection, forecasts, comparisons.
 *
 * The interface evolves automatically — no feature flags, purely from workspace maturity.
 */

import { TrendingUp, CheckCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { WorkspaceMode } from '@/components/workflow/operations-manager';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability/types';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import { formatCompactCurrency } from '@/lib/formatters/format-currency';

type InsightItem = {
  id: string;
  headline: string;
  context?: string;
  href?: string;
  type: 'positive' | 'neutral' | 'insight';
};

function buildInsights(
  mode: WorkspaceMode,
  kpis: OperationalKPIs | null,
  releaseConfidence: ReleaseConfidenceSnapshot | null,
  auditEntries: OperationalAuditEntry[]
): InsightItem[] {
  const items: InsightItem[] = [];
  const currency = releaseConfidence?.currency ?? 'AUD';

  if (mode === 'operational' || mode === 'mature') {
    const agreements = kpis?.participantCount ?? 0;
    const paid = auditEntries.filter((e) => e.type === 'release_batch_generated').length;
    const collected = releaseConfidence?.collectedRevenue ?? 0;
    const ready = releaseConfidence?.readyToRelease ?? 0;

    if (collected > 0) {
      items.push({
        id: 'revenue-collected',
        headline: `${formatCompactCurrency(collected, currency)} collected`,
        context: 'Revenue received through this agreement.',
        type: 'positive',
      });
    }

    if (ready > 0) {
      items.push({
        id: 'ready-to-release',
        headline: `${formatCompactCurrency(ready, currency)} ready to release`,
        context: 'Team members are ready to receive their payments.',
        href: '/dashboard/payouts/settlements',
        type: 'positive',
      });
    }

    if (paid > 0) {
      items.push({
        id: 'releases-completed',
        headline: `${paid} payout release${paid === 1 ? '' : 's'} completed`,
        context: 'Team members have received their payments.',
        type: 'neutral',
      });
    }

    if (agreements > 0) {
      items.push({
        id: 'team-operational',
        headline: `${agreements} team member${agreements === 1 ? '' : 's'} configured`,
        context: 'Earnings and approval status confirmed.',
        type: 'neutral',
      });
    }

    if (items.length === 0) {
      items.push({
        id: 'operational-status',
        headline: 'Agreement is commercially operational.',
        context: "Revenue is flowing and Provvy is monitoring settlement automatically.",
        type: 'positive',
      });
    }
  }

  if (mode === 'mature') {
    items.push({
      id: 'monitoring-active',
      headline: 'Provvy is actively monitoring this agreement.',
      context: "I'll notify you if settlement requires attention.",
      type: 'neutral',
    });
  }

  return items.slice(0, 4);
}

type CommercialInsightsProps = {
  mode: WorkspaceMode;
  kpis: OperationalKPIs | null;
  releaseConfidence: ReleaseConfidenceSnapshot | null;
  auditEntries?: OperationalAuditEntry[];
  className?: string;
};

/**
 * CommercialInsights — replaces workflow guidance panels for operational businesses.
 *
 * When the workspace is 'operational' or 'mature', operators don't need guidance —
 * they need intelligence. This panel surfaces what's happening, not what to do.
 */
export function CommercialInsights({
  mode,
  kpis,
  releaseConfidence,
  auditEntries = [],
  className,
}: CommercialInsightsProps) {
  const insights = buildInsights(mode, kpis, releaseConfidence, auditEntries);

  if (insights.length === 0) return null;

  return (
    <div className={cn('rounded-xl border border-[rgba(29,111,66,0.2)] bg-[rgba(29,111,66,0.03)] px-5 py-4 space-y-3', className)}>
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-[rgb(29,111,66)] shrink-0" aria-hidden />
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[rgb(29,111,66)]">
          Business intelligence
        </p>
      </div>

      <div className="space-y-2.5">
        {insights.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <CheckCircle
                className={cn(
                  'h-3.5 w-3.5 shrink-0 mt-0.5',
                  item.type === 'positive' ? 'text-[rgb(29,111,66)]' : 'text-muted-foreground/50'
                )}
                aria-hidden
              />
              <div className="min-w-0">
                <p className={cn(
                  'text-sm font-medium leading-snug',
                  item.type === 'positive' ? 'text-foreground' : 'text-foreground/80'
                )}>
                  {item.headline}
                </p>
                {item.context ? (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{item.context}</p>
                ) : null}
              </div>
            </div>
            {item.href ? (
              <Link
                href={item.href}
                className="shrink-0 flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Review
                <ArrowRight className="h-3 w-3" />
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Returns true when the workspace is mature enough to show insights instead of guidance.
 */
export function shouldShowInsights(mode: WorkspaceMode): boolean {
  return mode === 'operational' || mode === 'mature';
}
