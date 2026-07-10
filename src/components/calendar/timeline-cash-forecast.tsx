'use client';

import { format, parseISO } from 'date-fns';
import { formatForecastAmount } from '@/lib/commercial/commercial-forecast';
import type { CashFlowForecastPoint } from '@/lib/workspace-timeline/types';
import { cn } from '@/lib/utils';

type TimelineCashForecastProps = {
  points: CashFlowForecastPoint[];
  loading?: boolean;
};

export function TimelineCashForecast({ points, loading }: TimelineCashForecastProps) {
  if (loading) {
    return <div className="h-20 rounded-xl border border-border/40 bg-muted/20 animate-pulse" />;
  }

  if (points.length === 0) return null;

  const currency = points[0]?.currency ?? 'AUD';

  return (
    <div className="rounded-xl border border-border/50 bg-card px-5 py-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Expected cash balance
      </p>
      <div className="flex flex-wrap items-end gap-6">
        {points.map((point) => (
          <div key={point.date} className="space-y-0.5 min-w-[72px]">
            <p className="text-[10px] text-muted-foreground">
              {format(parseISO(point.date), 'd MMM')}
            </p>
            <p
              className={cn(
                'text-sm font-bold tabular-nums',
                point.isDeficit ? 'text-red-600' : 'text-foreground'
              )}
            >
              {formatForecastAmount(point.balance, currency)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
