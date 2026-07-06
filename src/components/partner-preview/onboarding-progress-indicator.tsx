'use client';

import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { OnboardingProgress } from '@/lib/data/mock-partner-preview';

interface OnboardingProgressIndicatorProps {
  progress: OnboardingProgress;
  compact?: boolean;
}

function getProgressColor(percent: number): string {
  if (percent >= 80) return '[&>[data-slot=progress-indicator]]:bg-green-500';
  if (percent >= 50) return '[&>[data-slot=progress-indicator]]:bg-amber-500';
  return '[&>[data-slot=progress-indicator]]:bg-red-500';
}

export function OnboardingProgressIndicator({
  progress,
  compact = false,
}: OnboardingProgressIndicatorProps) {
  const remainingStages = progress.stages.filter((s) => !s.completed);
  const nextStage = remainingStages[0];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={compact ? 'min-w-[80px]' : 'min-w-[120px]'}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Onboarding</span>
              <span className="font-medium">{progress.percent}%</span>
            </div>
            <Progress
              value={progress.percent}
              className={`h-1.5 ${getProgressColor(progress.percent)}`}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1.5 text-xs">
            {progress.stages.map((stage) => (
              <div key={stage.key} className="flex items-center gap-2">
                <span
                  className={
                    stage.completed ? 'text-green-500' : 'text-muted-foreground'
                  }
                >
                  {stage.completed ? '✓' : '○'}
                </span>
                <span className={stage.completed ? '' : 'text-muted-foreground'}>
                  {stage.label}
                </span>
              </div>
            ))}
            {nextStage?.remaining && (
              <p className="mt-2 border-t pt-2 text-muted-foreground">
                Remaining: {nextStage.remaining}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
