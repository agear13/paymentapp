'use client';

import { formatForecastAmount } from '@/lib/commercial/commercial-forecast';
import type { TimelineMonthSummary } from '@/lib/workspace-timeline/types';

type TimelineMonthSummaryBarProps = {
  summary: TimelineMonthSummary;
  loading?: boolean;
};

export function TimelineMonthSummaryBar({ summary, loading }: TimelineMonthSummaryBarProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  const items = [
    { label: 'Incoming expected', value: formatForecastAmount(summary.incomingExpected, summary.currency) },
    { label: 'Incoming confirmed', value: formatForecastAmount(summary.incomingConfirmed, summary.currency) },
    { label: 'Outgoing', value: formatForecastAmount(summary.outgoing, summary.currency) },
    {
      label: 'Forecast surplus',
      value: formatForecastAmount(summary.forecastSurplus, summary.currency),
      accent: summary.forecastSurplus < 0 ? 'text-red-600' : 'text-emerald-700',
    },
    { label: 'Projects active', value: String(summary.activeProjects), count: true },
    { label: 'Projects at risk', value: String(summary.projectsAtRisk), count: true, accent: summary.projectsAtRisk > 0 ? 'text-amber-700' : undefined },
    { label: 'Settlements waiting', value: String(summary.settlementsWaiting), count: true },
    { label: 'Approvals waiting', value: String(summary.approvalsWaiting), count: true },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5 space-y-0.5"
        >
          <p className="text-[10px] text-muted-foreground leading-tight">{item.label}</p>
          <p className={`text-sm font-semibold tabular-nums ${item.accent ?? 'text-foreground'}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
