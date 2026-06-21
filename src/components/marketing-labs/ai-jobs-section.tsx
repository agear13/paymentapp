'use client';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { MarketingJob, MarketingWorkspaceState } from '@/lib/marketing-jobs/types';
import {
  getActiveStageLabel,
  marketingJobStatusLabel,
  marketingJobTypeLabel,
  selectReadyAssetCount,
  selectVisualGenerationJob,
} from '@/lib/marketing-jobs';

type AiJobsSectionProps = {
  state: MarketingWorkspaceState;
};

function JobRow({
  title,
  status,
  progress,
  detail,
}: {
  title: string;
  status: string;
  progress?: number;
  detail?: string;
}) {
  const isCompleted = status.toLowerCase() === 'completed' || status.includes('Ready');

  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <Badge
          variant="outline"
          className={cn(
            isCompleted &&
              'border-[rgba(29,111,66,0.35)] bg-[rgba(29,111,66,0.06)] text-[rgb(29,111,66)]'
          )}
        >
          {status}
        </Badge>
      </div>
      {typeof progress === 'number' ? (
        <div className="mt-3 space-y-1.5">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground tabular-nums">{progress}%</p>
        </div>
      ) : null}
      {detail ? <p className="mt-2 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function describeJob(job: MarketingJob): string | undefined {
  if (job.outputs.campaignPackageExportedAt) {
    return `Dispatched ${new Date(job.outputs.campaignPackageExportedAt).toLocaleString()}`;
  }
  if (job.stages?.length) return getActiveStageLabel(job);
  if (job.outputs.notes) return job.outputs.notes;
  return undefined;
}

export function AiJobsSection({ state }: AiJobsSectionProps) {
  const visualJob = selectVisualGenerationJob(state.jobs);
  const copyJob = state.jobs.find((job) => job.jobType === 'generate_copy');
  const readyAssets = selectReadyAssetCount(state.assets);

  const visualStatus = visualJob
    ? visualJob.status === 'completed'
      ? 'Completed'
      : getActiveStageLabel(visualJob)
    : 'Not started';

  return (
    <section id="ai-jobs" className="scroll-mt-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">AI Jobs</h2>
        <p className="text-sm text-muted-foreground">
          Orchestrated marketing work tracked by Provvypay.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active & recent jobs</CardTitle>
          <CardDescription>Specialist stages update as the AI team progresses.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <JobRow
            title={visualJob ? marketingJobTypeLabel(visualJob.jobType) : 'Visual Generation'}
            status={visualStatus}
            progress={visualJob?.progress}
            detail={visualJob ? describeJob(visualJob) : 'Generate visuals to begin.'}
          />

          <JobRow
            title="Campaign Package Exported"
            status={
              state.creativeDispatch.status === 'dispatched'
                ? 'Dispatched'
                : state.creativeDispatch.status === 'ready_for_dispatch'
                  ? 'Ready'
                  : 'Pending'
            }
            detail={
              state.creativeDispatch.dispatchedAt
                ? `Dispatched ${new Date(state.creativeDispatch.dispatchedAt).toLocaleString()}`
                : 'Dispatch when the AI team completes planning.'
            }
          />

          <JobRow
            title="Visual Assets"
            status={readyAssets > 0 ? `${readyAssets} Ready` : 'Awaiting import'}
            detail={
              readyAssets > 0
                ? `${readyAssets} of ${state.assets.length} assets imported.`
                : 'Import assets.json after creative production.'
            }
          />

          {copyJob ? (
            <JobRow
              title={marketingJobTypeLabel(copyJob.jobType)}
              status={marketingJobStatusLabel(copyJob.status)}
              progress={copyJob.progress}
              detail={describeJob(copyJob)}
            />
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
