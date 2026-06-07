'use client';

import { cn } from '@/lib/utils';
import {
  resolveOnboardingProgressStep,
  type OnboardingStep,
} from '@/lib/onboarding/operator-onboarding-types';

const VISUAL_PHASES = [
  'Create Workspace',
  'Create Agreement',
  'Intelligence Review',
  'Configure Coordination',
  'Ready',
] as const;

const AGREEMENT_BUILD_STEPS: OnboardingStep[] = [
  'import_source',
  'import_content',
  'template_select',
  'project',
  'participants',
];

function visualPhaseIndex(step: OnboardingStep): number {
  if (AGREEMENT_BUILD_STEPS.includes(step)) return 1;
  const progressStep = resolveOnboardingProgressStep(step);
  switch (progressStep) {
    case 'workspace':
      return 0;
    case 'start_method':
      return 1;
    case 'agreement_review':
      return 2;
    case 'use_case':
    case 'funding':
    case 'payment_rails':
      return 3;
    case 'complete':
      return 4;
    default:
      return 0;
  }
}

type OnboardingVisualProgressProps = {
  step: OnboardingStep;
  className?: string;
};

export function OnboardingVisualProgress({ step, className }: OnboardingVisualProgressProps) {
  const activeIndex = visualPhaseIndex(step);

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-[rgb(124,92,255)]">
          Agreement Setup Progress
        </p>
        <span className="text-xs text-muted-foreground">
          Phase {activeIndex + 1} of {VISUAL_PHASES.length}
        </span>
      </div>

      <div className="hidden sm:flex items-center gap-1">
        {VISUAL_PHASES.map((label, index) => {
          const isComplete = index < activeIndex;
          const isActive = index === activeIndex;
          return (
            <div key={label} className="flex flex-1 items-center gap-1 min-w-0">
              <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-300',
                    isComplete && 'border-[rgb(124,92,255)] bg-[rgb(124,92,255)] text-white',
                    isActive &&
                      'border-[rgb(124,92,255)] bg-[rgba(124,92,255,0.12)] text-[rgb(124,92,255)] ring-4 ring-[rgba(124,92,255,0.12)]',
                    !isComplete && !isActive && 'border-border bg-background text-muted-foreground'
                  )}
                >
                  {index + 1}
                </div>
                <span
                  className={cn(
                    'text-[10px] leading-tight text-center truncate w-full px-0.5',
                    isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {label}
                </span>
              </div>
              {index < VISUAL_PHASES.length - 1 ? (
                <div
                  className={cn(
                    'h-0.5 w-full min-w-[12px] rounded-full mb-5 transition-colors duration-300',
                    index < activeIndex ? 'bg-[rgb(124,92,255)]' : 'bg-border'
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="sm:hidden space-y-2">
        <div className="flex gap-1">
          {VISUAL_PHASES.map((_, index) => (
            <div
              key={index}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors duration-300',
                index <= activeIndex ? 'bg-[rgb(124,92,255)]' : 'bg-border'
              )}
            />
          ))}
        </div>
        <p className="text-sm font-medium">{VISUAL_PHASES[activeIndex]}</p>
      </div>
    </div>
  );
}
