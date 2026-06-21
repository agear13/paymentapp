'use client';

import * as React from 'react';
import { CheckCircle2, Circle, Loader2, Send } from 'lucide-react';
import { marketingToasts } from '@/lib/marketing-jobs/notifications';
import { MarketingActionButton } from '@/components/marketing-labs/marketing-action-button';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MarketingJobEngine } from '@/lib/marketing-jobs/job-engine';
import type { DistributionPipelineStage, MarketingWorkspaceState } from '@/lib/marketing-jobs/types';
import {
  buildDistributionPipeline,
  buildLifecycleTimeline,
  buildOperationsPublishingCard,
  buildPublicationScheduleView,
  isCreativeAssetsReady,
} from '@/lib/marketing-jobs/campaign-lifecycle';

type MarketingOperationsSectionProps = {
  state: MarketingWorkspaceState;
  engine: MarketingJobEngine;
};

function formatTimestamp(iso?: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function milestoneIcon(status: 'complete' | 'pending' | 'waiting') {
  if (status === 'complete') return <CheckCircle2 className="size-4 text-[rgb(29,111,66)]" />;
  if (status === 'pending') return <Loader2 className="size-4 animate-spin text-primary" />;
  return <Circle className="size-4 text-muted-foreground" />;
}

export function MarketingOperationsSection({ state, engine }: MarketingOperationsSectionProps) {
  if (!isCreativeAssetsReady(state)) return null;

  const publishingCard = buildOperationsPublishingCard(state);
  const schedule = buildPublicationScheduleView(state);
  const pipeline = buildDistributionPipeline(state);
  const timeline = buildLifecycleTimeline(state);

  const handleApprovePublishing = async () => {
    try {
      engine.approveForPublishing();
      marketingToasts.publishingApproved();
    } catch (error) {
      marketingToasts.error(error instanceof Error ? error.message : 'Could not approve publishing.');
      throw error;
    }
  };

  return (
    <section id="marketing-operations" className="scroll-mt-6 space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Marketing Operations</h2>
        <p className="text-sm text-muted-foreground">What happens next — publishing, distribution, and review.</p>
      </div>

      {publishingCard ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaign Publishing</CardTitle>
            <CardDescription>Operational readiness for distribution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <StatusRow label="Campaign Status" value={publishingCard.campaignStatus} />
              <StatusRow label="Creative Assets" value={`${publishingCard.creativeAssetsComplete} Complete`} />
              <StatusRow label="Client Approval" value={publishingCard.clientApprovalStatus} />
              <StatusRow label="Distribution" value={publishingCard.distributionStatus} />
            </div>
            {publishingCard.showApproveCta ? (
              <MarketingActionButton
                idleLabel={
                  <>
                    <Send className="mr-2 size-4" />
                    Approve for Publishing
                  </>
                }
                loadingLabel="Approving…"
                successLabel="Approved ✓"
                onAction={handleApprovePublishing}
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {schedule ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Publication Schedule</CardTitle>
            <CardDescription>AI-recommended timing — no external scheduler connected</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {schedule.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="font-medium">{item.channel}</span>
                <span className="text-muted-foreground tabular-nums">
                  {item.day} · {item.time}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <DistributionProgressCard stages={pipeline} />
        <LifecycleTimelineCard milestones={timeline} />
      </div>
    </section>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function DistributionProgressCard({ stages }: { stages: DistributionPipelineStage[] }) {
  return (
    <Card className="transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="text-base">Publishing Progress</CardTitle>
        <CardDescription>From approval through results and review</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-0">
          {stages.map((stage, index) => (
            <li key={stage.id} className="relative flex gap-3 pb-6 last:pb-0">
              {index < stages.length - 1 ? (
                <span className="absolute left-[11px] top-6 h-[calc(100%-0.5rem)] w-px bg-border" aria-hidden />
              ) : null}
              <div className="relative z-10 mt-0.5">
                {stage.status === 'complete' ? (
                  <CheckCircle2 className="size-5 text-[rgb(29,111,66)]" />
                ) : stage.status === 'active' ? (
                  <Loader2 className="size-5 animate-spin text-primary" />
                ) : (
                  <Circle className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{stage.label}</p>
                  <Badge variant="outline" className={cn('capitalize text-[10px]', stage.status === 'complete' && 'border-[rgba(29,111,66,0.35)] text-[rgb(29,111,66)]')}>
                    {stage.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{stage.description}</p>
                {stage.timestamp ? (
                  <p className="text-xs text-muted-foreground">{formatTimestamp(stage.timestamp)}</p>
                ) : null}
                {stage.nextAction ? (
                  <p className="text-xs font-medium text-primary">{stage.nextAction}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function LifecycleTimelineCard({
  milestones,
}: {
  milestones: ReturnType<typeof buildLifecycleTimeline>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Campaign Lifecycle Timeline</CardTitle>
        <CardDescription>End-to-end campaign progress</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {milestones.map((milestone) => (
            <li key={milestone.id} className="flex items-start gap-3 text-sm">
              {milestoneIcon(milestone.status)}
              <div className="flex-1">
                <p className={cn('font-medium', milestone.status === 'waiting' && 'text-muted-foreground')}>
                  {milestone.label}
                </p>
                {milestone.completedAt ? (
                  <p className="text-xs text-muted-foreground">{formatTimestamp(milestone.completedAt)}</p>
                ) : null}
              </div>
              <span className="text-xs capitalize text-muted-foreground">
                {milestone.status === 'complete' ? '✓' : milestone.status}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
