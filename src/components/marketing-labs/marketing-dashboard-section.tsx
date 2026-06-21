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
import type { MarketingWorkspaceState } from '@/lib/marketing-jobs/types';
import {
  buildDashboardActivity,
  selectReadyAssetCount,
  selectVisualGenerationJob,
} from '@/lib/marketing-jobs';
import { MARKETING_DEMO_BRAND } from '@/lib/marketing-jobs/demo-brand';
import { MarketingEmptyState } from '@/components/marketing-labs/marketing-empty-state';
import { MARKETING_EMPTY_STATES } from '@/lib/marketing-labs/empty-states';
import { MARKETING_DASHBOARD_PLACEHOLDER } from '@/lib/marketing-labs/placeholder-data';

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

type MarketingDashboardSectionProps = {
  state: MarketingWorkspaceState;
};

export function MarketingDashboardSection({ state }: MarketingDashboardSectionProps) {
  const visualJob = selectVisualGenerationJob(state.jobs);
  const readyAssets = selectReadyAssetCount(state.assets);
  const activity = buildDashboardActivity(state);
  const metrics = MARKETING_DASHBOARD_PLACEHOLDER;

  const companyBrainStatus =
    metrics.companyBrainStatus === 'Built' ? 'Built' : 'Pending Build';

  return (
    <section id="marketing-dashboard" className="scroll-mt-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Marketing Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          {MARKETING_DEMO_BRAND} marketing overview — credits, Creative Assets, and time saved.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <SummaryMetricCard
          label="Company Brain"
          value={companyBrainStatus}
          accent={companyBrainStatus === 'Built' ? 'success' : 'default'}
        />
        <SummaryMetricCard
          label="Campaign Credits"
          value={`${metrics.campaignCreditsRemaining} Remaining`}
        />
        <SummaryMetricCard
          label="Visual Job"
          value={visualJob ? visualJob.status : 'Not started'}
          accent={visualJob?.status === 'completed' ? 'success' : 'default'}
        />
        <SummaryMetricCard
          label="Creative Assets Ready"
          value={String(readyAssets)}
          accent={readyAssets > 0 ? 'success' : 'default'}
        />
        <SummaryMetricCard
          label="Hours Saved"
          value={String(metrics.hoursSaved)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Live orchestration updates from your marketing workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <MarketingEmptyState content={MARKETING_EMPTY_STATES.dashboardActivity} ctaHref="#marketing-command-centre" />
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
