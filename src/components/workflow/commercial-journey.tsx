'use client';

/**
 * Commercial Journey
 *
 * The single 9-step progress model for Provvypay.
 *
 * Every screen that shows progress references this component.
 * No independent progress systems.
 *
 * Steps:
 *   Business created → Agreement created → Team configured → Earnings configured
 *   → Approvals complete → Payments enabled → Revenue collecting
 *   → Ready for settlement → Operational
 *
 * Each step maps to a WorkflowStage transition. Status is computed from the
 * shared CommercialBrain (or passed directly as a prop for non-agreement contexts).
 */

import * as React from 'react';
import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';
import { Check, Circle, Dot } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkflowStage } from '@/components/workflow/workflow-context';

/* ─── Journey step definitions ─── */

type JourneyStep = {
  id: string;
  label: string;
  /**
   * This step is "done" when the current stage is at or past the stage named here.
   * null = always done (e.g. "Business created" is done when the app exists).
   */
  completedWhen: WorkflowStage | null;
  /**
   * This step is "current" when the current stage equals this stage value.
   */
  currentWhen: WorkflowStage;
};

export const COMMERCIAL_JOURNEY_STEPS: JourneyStep[] = [
  {
    id: 'business-created',
    label: 'Business created',
    completedWhen: null, // always done — workspace exists
    currentWhen: 'setup',
  },
  {
    id: 'agreement-created',
    label: 'Project created',
    completedWhen: 'configuring',
    currentWhen: 'setup',
  },
  {
    id: 'team-configured',
    label: 'Team configured',
    completedWhen: 'collecting-approvals',
    currentWhen: 'configuring',
  },
  {
    id: 'earnings-configured',
    label: 'Earnings configured',
    completedWhen: 'collecting-approvals',
    currentWhen: 'collecting-approvals',
  },
  {
    id: 'approvals-complete',
    label: 'Approvals complete',
    completedWhen: 'preparing-payments',
    currentWhen: 'collecting-approvals',
  },
  {
    id: 'payments-enabled',
    label: 'Payments enabled',
    completedWhen: 'ready-to-collect',
    currentWhen: 'preparing-payments',
  },
  {
    id: 'revenue-collecting',
    label: 'Revenue collecting',
    completedWhen: 'ready-to-release',
    currentWhen: 'collecting-revenue',
  },
  {
    id: 'ready-for-settlement',
    label: 'Ready for settlement',
    completedWhen: 'operational',
    currentWhen: 'ready-to-release',
  },
  {
    id: 'operational',
    label: 'Operational',
    completedWhen: 'operational',
    currentWhen: 'operational',
  },
];

/* ─── Stage ordering ─── */

const STAGE_ORDER: WorkflowStage[] = [
  'setup',
  'configuring',
  'collecting-approvals',
  'preparing-payments',
  'ready-to-collect',
  'collecting-revenue',
  'ready-to-release',
  'operational',
];

function stageIndex(stage: WorkflowStage): number {
  return STAGE_ORDER.indexOf(stage);
}

/* ─── Step status derivation ─── */

export type StepStatus = 'done' | 'current' | 'future';

export function getJourneyStepStatus(
  step: JourneyStep,
  currentStage: WorkflowStage
): StepStatus {
  // Business created is always done
  if (step.completedWhen === null) return 'done';

  const currentIdx = stageIndex(currentStage);
  const completedIdx = stageIndex(step.completedWhen);
  const currentWhenIdx = stageIndex(step.currentWhen);

  // Step is done if current stage is past the completion stage
  if (currentIdx >= completedIdx) return 'done';

  // Step is current if current stage matches the active stage for this step
  if (currentWhenIdx === currentIdx) return 'current';

  return 'future';
}

/* ─── Rendering variants ─── */

export type CommercialJourneyVariant = 'horizontal' | 'vertical' | 'compact';

/* ─── Horizontal variant (default, inline) ─── */

function HorizontalJourneyStep({
  step,
  status,
}: {
  step: JourneyStep;
  status: StepStatus;
}) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-1.5 py-0.5 px-1">
        {status === 'done' ? (
          <div className="h-4 w-4 rounded-full bg-[rgb(29,111,66)] flex items-center justify-center shrink-0">
            <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} aria-hidden />
          </div>
        ) : status === 'current' ? (
          <div className="h-4 w-4 rounded-full border-2 border-[rgb(124,92,255)] bg-[rgba(124,92,255,0.1)] flex items-center justify-center shrink-0">
            <Dot className="h-3 w-3 text-[rgb(124,92,255)]" aria-hidden />
          </div>
        ) : (
          <Circle className="h-4 w-4 text-border/50 shrink-0" />
        )}
        <span
          className={cn(
            'text-xs whitespace-nowrap',
            status === 'done' && 'text-muted-foreground/60 line-through decoration-muted-foreground/30',
            status === 'current' && 'font-semibold text-[rgb(124,92,255)]',
            status === 'future' && 'text-muted-foreground/40'
          )}
        >
          {step.label}
        </span>
      </div>
    </div>
  );
}

/* ─── Vertical variant (sidebar/panel) ─── */

function VerticalJourneyStep({
  step,
  status,
}: {
  step: JourneyStep;
  status: StepStatus;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <div className="relative flex items-center justify-center shrink-0">
        {status === 'done' ? (
          <div className="h-5 w-5 rounded-full bg-[rgb(29,111,66)] flex items-center justify-center">
            <Check className="h-3 w-3 text-white" strokeWidth={3} aria-hidden />
          </div>
        ) : status === 'current' ? (
          <div className="h-5 w-5 rounded-full border-2 border-[rgb(124,92,255)] bg-[rgba(124,92,255,0.1)] flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-[rgb(124,92,255)]" />
          </div>
        ) : (
          <div className="h-5 w-5 rounded-full border border-border/40 bg-white" />
        )}
      </div>
      <span
        className={cn(
          'text-sm leading-snug',
          status === 'done' && 'text-muted-foreground/60 line-through decoration-muted-foreground/30',
          status === 'current' && 'font-semibold text-foreground',
          status === 'future' && 'text-muted-foreground/50'
        )}
      >
        {step.label}
      </span>
    </li>
  );
}

/* ─── Main component ─── */

type CommercialJourneyProps = {
  currentStage: WorkflowStage;
  variant?: CommercialJourneyVariant;
  /** Only show active ± N steps for a compact view */
  windowSize?: number;
  className?: string;
  showLabel?: boolean;
};

/**
 * CommercialJourney — the single shared progress model.
 *
 * Every screen that wants to show commercial progress uses this component.
 * It is the only implementation of the journey concept in the codebase.
 *
 * Variants:
 *   horizontal — inline step trail (for headers, cards)
 *   vertical   — sidebar checklist (for overview pages, briefings)
 *   compact    — shows only current ± a window of steps
 */
export function CommercialJourney({
  currentStage,
  variant = 'horizontal',
  windowSize,
  className,
  showLabel = true,
}: CommercialJourneyProps) {
  const steps = COMMERCIAL_JOURNEY_STEPS;
  const currentIdx = steps.findIndex((s) => getJourneyStepStatus(s, currentStage) === 'current');

  // Apply window around current step if requested
  const visibleSteps =
    windowSize != null && currentIdx >= 0
      ? steps.filter(
          (_, i) => i >= Math.max(0, currentIdx - 1) && i <= currentIdx + windowSize - 1
        )
      : steps;

  if (variant === 'vertical') {
    return (
      <div className={cn('space-y-1', className)}>
        {showLabel ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
            Commercial journey
          </p>
        ) : null}
        <ul className="space-y-2.5 pl-0">
          {visibleSteps.map((step) => (
            <VerticalJourneyStep
              key={step.id}
              step={step}
              status={getJourneyStepStatus(step, currentStage)}
            />
          ))}
        </ul>
      </div>
    );
  }

  if (variant === 'compact') {
    // Show only current + nearby steps inline
    return (
      <div className={cn('flex items-center gap-1 flex-wrap', className)}>
        {visibleSteps.map((step, i) => {
          const status = getJourneyStepStatus(step, currentStage);
          return (
            <React.Fragment key={step.id}>
              <HorizontalJourneyStep step={step} status={status} />
              {i < visibleSteps.length - 1 ? (
                <div className="h-px w-2.5 bg-border/30 shrink-0" aria-hidden />
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  // Default: horizontal
  return (
    <div className={cn('space-y-1.5', className)}>
      {showLabel ? (
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Commercial journey
        </p>
      ) : null}
      <div className="flex items-center gap-0 flex-wrap">
        {visibleSteps.map((step, i) => {
          const status = getJourneyStepStatus(step, currentStage);
          return (
            <React.Fragment key={step.id}>
              <HorizontalJourneyStep step={step} status={status} />
              {i < visibleSteps.length - 1 ? (
                <div className="h-px w-3 bg-border/30 shrink-0" aria-hidden />
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

