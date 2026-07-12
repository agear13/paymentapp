'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CommercialMetricValue } from '@/lib/participant-portal/participant-portal-types';

type Props = {
  metrics: CommercialMetricValue[];
  title?: string;
  className?: string;
};

export function CommercialMetricsGrid({ metrics, title, className }: Props) {
  if (metrics.length === 0) return null;

  return (
    <div className={className}>
      {title ? <h3 className="text-sm font-medium text-muted-foreground mb-3">{title}</h3> : null}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.field} className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{metric.label}</p>
            <p className="text-lg font-semibold mt-1 tabular-nums">{metric.value}</p>
            {metric.emptyMessage && metric.value === '—' ? (
              <p className="text-xs text-muted-foreground mt-1 leading-snug">{metric.emptyMessage}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

type PerformanceCardProps = {
  metrics: CommercialMetricValue[];
  hasRecordedActivity: boolean;
  className?: string;
};

/** Performance metrics for commission, revenue share, and attribution models. */
export function CommercialPerformanceCard({
  metrics,
  hasRecordedActivity,
  className,
}: PerformanceCardProps) {
  const performanceMetrics = metrics.filter((m) =>
    [
      'revenue_generated',
      'attributed_sales',
      'orders',
      'conversions',
      'commission_earned',
      'average_order_value',
      'referral_link',
      'promo_code',
    ].includes(m.field)
  );

  if (performanceMetrics.length === 0) return null;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasRecordedActivity ? (
          <p className="text-sm text-muted-foreground">
            No commercial activity has been recorded yet. Performance metrics will appear once
            attributed sales or revenue are recorded.
          </p>
        ) : (
          <CommercialMetricsGrid metrics={performanceMetrics} />
        )}
      </CardContent>
    </Card>
  );
}
