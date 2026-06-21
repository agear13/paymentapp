'use client';

import { CheckCircle2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { CampaignPackageSummary, MarketingWorkspaceState } from '@/lib/marketing-jobs/types';
import { buildCampaignPackageSummary } from '@/lib/marketing-jobs';

type CampaignPackageCardProps = {
  state: MarketingWorkspaceState;
};

function productionLabel(status: CampaignPackageSummary['creativeProductionStatus']): string {
  switch (status) {
    case 'complete':
      return 'Complete';
    case 'in_progress':
      return 'In progress';
    default:
      return 'Pending';
  }
}

function dispatchLabel(status: CampaignPackageSummary['dispatchStatus']): string {
  switch (status) {
    case 'dispatched':
      return 'Dispatched to AI Creative Team';
    case 'ready_for_dispatch':
      return 'Ready for dispatch';
    default:
      return 'Preparing';
  }
}

export function CampaignPackageCard({ state }: CampaignPackageCardProps) {
  const summary = buildCampaignPackageSummary(state);
  const showCard =
    summary.status === 'ready' ||
    summary.dispatchStatus === 'dispatched' ||
    summary.dispatchStatus === 'ready_for_dispatch';

  if (!showCard) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Campaign Package</CardTitle>
            <CardDescription>Structured hand-off for the AI Creative Team</CardDescription>
          </div>
          <Badge
            variant="outline"
            className={cn(
              summary.status === 'ready' &&
                'border-[rgba(29,111,66,0.35)] bg-[rgba(29,111,66,0.06)] text-[rgb(29,111,66)]'
            )}
          >
            {summary.status === 'ready' ? 'Ready' : 'Pending'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Contains
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {summary.contains.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 shrink-0 text-[rgb(29,111,66)]" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </p>
            <p className="text-sm font-medium">{dispatchLabel(summary.dispatchStatus)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Creative Production
            </p>
            <p className="text-sm font-medium">{productionLabel(summary.creativeProductionStatus)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Estimated Duration
            </p>
            <p className="text-sm font-medium">{summary.estimatedDurationMinutes} minutes</p>
          </div>
        </div>

        {summary.dispatchStatus === 'dispatched' &&
        summary.creativeProductionStatus !== 'complete' ? (
          <div className="space-y-2">
            <Progress value={summary.creativeProductionStatus === 'in_progress' ? 55 : 15} />
            <p className="text-xs text-muted-foreground">
              Import generated assets when the AI Creative Team completes production.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
