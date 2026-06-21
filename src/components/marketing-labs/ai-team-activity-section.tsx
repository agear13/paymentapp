'use client';

import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { MarketingWorkspaceState } from '@/lib/marketing-jobs/types';
import { buildAiTeamActivity, selectVisualGenerationJob } from '@/lib/marketing-jobs';
import { getSpecialistIcon } from '@/components/marketing-labs/specialist-icon';
import { MarketingEmptyState } from '@/components/marketing-labs/marketing-empty-state';

type AiTeamActivitySectionProps = {
  state: MarketingWorkspaceState;
};

function formatActivityTime(iso?: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function AiTeamActivitySection({ state }: AiTeamActivitySectionProps) {
  const visualJob = selectVisualGenerationJob(state.jobs);
  const activity = buildAiTeamActivity(visualJob);

  return (
    <section id="ai-team-activity" className="scroll-mt-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">AI Team Activity</h2>
        <p className="text-sm text-muted-foreground">
          Specialist workflow as your AI marketing team prepares the campaign package.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Production timeline</CardTitle>
          <CardDescription>
            {visualJob
              ? 'Specialists coordinate in sequence until the package is ready for dispatch.'
              : 'Generate visuals to begin AI team coordination.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!visualJob || activity.length === 0 ? (
            <MarketingEmptyState message="AI team activity will appear once visual generation begins." />
          ) : (
            <ol className="space-y-0">
              {activity.map((entry, index) => {
                const Icon = getSpecialistIcon(entry.icon);
                const time = formatActivityTime(entry.completedAt);
                const isCompleted = entry.status === 'completed';
                const isActive = entry.status === 'active';

                return (
                  <li key={entry.id} className="relative flex gap-4 pb-8 last:pb-0">
                    {index < activity.length - 1 ? (
                      <span
                        className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-border"
                        aria-hidden
                      />
                    ) : null}
                    <div
                      className={cn(
                        'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background',
                        isCompleted && 'border-[rgba(29,111,66,0.35)] text-[rgb(29,111,66)]',
                        isActive && 'border-primary text-primary'
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="size-4" />
                      ) : isActive ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Circle className="size-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Icon className="size-4 text-muted-foreground" />
                        <p className="text-sm font-semibold">{entry.role}</p>
                        {time ? (
                          <span className="text-xs text-muted-foreground tabular-nums">{time}</span>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">{entry.description}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
