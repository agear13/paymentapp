'use client';

import { cn } from '@/lib/utils';
import {
  resolveOnboardingProgressStep,
  type OnboardingStep,
} from '@/lib/onboarding/operator-onboarding-types';

/** Short labels fit the stepper row without clipping; mobile shows the active full label. */
const VISUAL_PHASES = [
  { id: 'workspace', label: 'Workspace', mobileLabel: 'Create Workspace' },
  { id: 'agreement', label: 'Agreement', mobileLabel: 'Create Agreement' },
  { id: 'review', label: 'Review', mobileLabel: 'Intelligence Review' },
  { id: 'configure', label: 'Configure', mobileLabel: 'Configure Coordination' },
  { id: 'ready', label: 'Ready', mobileLabel: 'Ready' },
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
  const activePhase = VISUAL_PHASES[activeIndex];

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgb(124,92,255)]">
          Setup progress
        </p>
        <span className="text-xs text-muted-foreground tabular-nums">
          {activeIndex + 1} / {VISUAL_PHASES.length}
        </span>
      </div>

      <div className="hidden sm:block">
        <div className="relative pt-1">
          <div
            className="absolute left-[10%] right-[10%] top-4 h-px bg-border"
            aria-hidden
          />
          <div
            className="absolute left-[10%] top-4 h-px bg-[rgb(124,92,255)] transition-all duration-300"
            style={{ width: `${(activeIndex / (VISUAL_PHASES.length - 1)) * 80}%` }}
            aria-hidden
          />
          <div className="relative grid grid-cols-5 gap-2">
            {VISUAL_PHASES.map((phase, index) => {
              const isComplete = index < activeIndex;
              const isActive = index === activeIndex;

              return (
                <div key={phase.id} className="flex flex-col items-center gap-2 text-center">
                  <div
                    className={cn(
                      'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-300',
                      isComplete && 'border-[rgb(124,92,255)] bg-[rgb(124,92,255)] text-white',
                      isActive &&
                        'border-[rgb(124,92,255)] bg-[rgba(124,92,255,0.12)] text-[rgb(124,92,255)] ring-4 ring-[rgba(124,92,255,0.1)]',
                      !isComplete && !isActive && 'border-border bg-background text-muted-foreground'
                    )}
                  >
                    {isComplete ? '✓' : index + 1}
                  </div>
                  <span
                    className={cn(
                      'text-xs leading-snug',
                      isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {phase.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="sm:hidden space-y-2">
        <div className="flex gap-1.5">
          {VISUAL_PHASES.map((_, index) => (
            <div
              key={index}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-300',
                index <= activeIndex ? 'bg-[rgb(124,92,255)]' : 'bg-border'
              )}
            />
          ))}
        </div>
        <p className="text-sm font-medium">{activePhase.mobileLabel}</p>
      </div>
    </div>
  );
}
