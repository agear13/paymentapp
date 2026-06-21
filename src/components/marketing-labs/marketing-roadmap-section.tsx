'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MarketingRoadmapItemStatus, MarketingWorkspaceState } from '@/lib/marketing-jobs/types';
import { buildMarketingRoadmap, isCreativeAssetsReady } from '@/lib/marketing-jobs/campaign-lifecycle';

type MarketingRoadmapSectionProps = {
  state: MarketingWorkspaceState;
};

function roadmapBadgeClass(status: MarketingRoadmapItemStatus): string {
  switch (status) {
    case 'completed':
      return 'border-[rgba(29,111,66,0.35)] bg-[rgba(29,111,66,0.06)] text-[rgb(29,111,66)]';
    case 'pending_approval':
      return 'border-primary/35 bg-primary/5 text-primary';
    case 'recommended':
      return 'border-amber-500/35 bg-amber-500/5 text-amber-700 dark:text-amber-400';
    default:
      return '';
  }
}

function roadmapLabel(status: MarketingRoadmapItemStatus): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'pending_approval':
      return 'Pending Approval';
    case 'recommended':
      return 'Recommended';
    default:
      return 'Upcoming';
  }
}

export function MarketingRoadmapSection({ state }: MarketingRoadmapSectionProps) {
  if (!isCreativeAssetsReady(state)) return null;

  const items = buildMarketingRoadmap(state);

  return (
    <section id="marketing-roadmap" className="scroll-mt-6">
      <Card className="bg-muted/20">
        <CardHeader>
          <CardTitle className="text-base">Marketing Roadmap</CardTitle>
          <CardDescription>Continuous marketing — not one-off campaigns.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border bg-card px-3 py-3">
              <p className="text-sm font-medium">{item.label}</p>
              <Badge variant="outline" className={cn('mt-2', roadmapBadgeClass(item.status))}>
                {roadmapLabel(item.status)}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
