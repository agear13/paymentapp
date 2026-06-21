'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  MARKETING_DASHBOARD_PLACEHOLDER,
  MARKETING_RECENT_ACTIVITY,
} from '@/lib/marketing-labs/placeholder-data';
import { MarketingEmptyState } from '@/components/marketing-labs/marketing-empty-state';

function SummaryMetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'default' | 'success';
}) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card px-4 py-4 shadow-sm',
        accent === 'success' && 'border-[rgba(29,111,66,0.25)] bg-[rgba(29,111,66,0.03)]'
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-2 text-2xl font-bold tabular-nums tracking-tight',
          accent === 'success' && 'text-[rgb(29,111,66)]'
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function MarketingDashboardSection() {
  const metrics = MARKETING_DASHBOARD_PLACEHOLDER;
  const activity = MARKETING_RECENT_ACTIVITY;

  return (
    <section id="marketing-dashboard" className="scroll-mt-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Marketing Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Overview of your AI Marketing Team activity and campaign credits.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <SummaryMetricCard
          label="Company Brain"
          value={metrics.companyBrainStatus}
          accent={metrics.companyBrainStatus === 'Built' ? 'success' : 'default'}
        />
        <SummaryMetricCard
          label="Campaign Credits"
          value={`${metrics.campaignCreditsRemaining} Remaining`}
        />
        <SummaryMetricCard
          label="Campaigns Generated"
          value={String(metrics.campaignsGenerated)}
        />
        <SummaryMetricCard
          label="Assets Generated"
          value={String(metrics.assetsGenerated)}
        />
        <SummaryMetricCard
          label="Hours Saved"
          value={String(metrics.hoursSaved)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest updates from your AI Marketing Team.</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <MarketingEmptyState message="Activity will appear here as your AI Marketing Team completes work." />
          ) : (
            <ul className="space-y-3">
              {activity.map((item) => (
                <li key={item.id} className="flex items-start gap-3 text-sm">
                  {item.completed ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[rgb(29,111,66)]" />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={cn(!item.completed && 'text-muted-foreground')}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
