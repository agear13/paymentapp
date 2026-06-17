'use client';

import { Check, Circle, Dot } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkflowContext, WorkflowStage } from '@/components/workflow/workflow-context';

/* ─── Journey step definition ─── */

type JourneyStep = {
  id: WorkflowStage;
  label: string;
  detail?: string;
};

const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: 'setup',
    label: 'Business created',
  },
  {
    id: 'configuring',
    label: 'Agreement prepared',
  },
  {
    id: 'collecting-approvals',
    label: 'Team ready',
    detail: 'Earnings configured',
  },
  {
    id: 'preparing-payments',
    label: 'Approvals collected',
  },
  {
    id: 'ready-to-collect',
    label: 'Payments enabled',
    detail: 'Payment provider connected',
  },
  {
    id: 'collecting-revenue',
    label: 'Ready to collect',
  },
  {
    id: 'ready-to-release',
    label: 'Ready to release',
  },
  {
    id: 'operational',
    label: 'Commercially operational',
  },
];

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

type StepStatus = 'done' | 'current' | 'future';

function getStepStatus(stepId: WorkflowStage, currentStage: WorkflowStage): StepStatus {
  const stepIdx = STAGE_ORDER.indexOf(stepId);
  const currentIdx = STAGE_ORDER.indexOf(currentStage);

  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'current';
  return 'future';
}

/* ─── Step item ─── */

function JourneyStepItem({
  step,
  status,
}: {
  step: JourneyStep;
  status: StepStatus;
}) {
  return (
    <li className="flex items-start gap-3">
      <div className="shrink-0 mt-0.5">
        {status === 'done' ? (
          <div className="h-4 w-4 rounded-full bg-[rgb(29,111,66)] flex items-center justify-center">
            <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} aria-hidden />
          </div>
        ) : status === 'current' ? (
          <div className="h-4 w-4 rounded-full border-2 border-[rgb(124,92,255)] bg-[rgba(124,92,255,0.1)] flex items-center justify-center">
            <Dot className="h-3 w-3 text-[rgb(124,92,255)]" aria-hidden />
          </div>
        ) : (
          <div className="h-4 w-4 rounded-full border border-border/50 flex items-center justify-center">
            <Circle className="h-2 w-2 text-border/50" aria-hidden />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            'text-xs font-medium leading-snug',
            status === 'done' && 'text-muted-foreground line-through decoration-muted-foreground/40',
            status === 'current' && 'text-[rgb(124,92,255)]',
            status === 'future' && 'text-muted-foreground/60'
          )}
        >
          {step.label}
        </p>
        {step.detail && status !== 'future' ? (
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{step.detail}</p>
        ) : null}
      </div>
    </li>
  );
}

/* ─── CommercialReadiness ─── */

/**
 * Commercial Readiness — the commercial journey checklist.
 *
 * A vertical list of milestones showing where the operator is in the journey.
 * Completed steps are green ✓ with strikethrough.
 * Current step is purple ●.
 * Future steps are muted ○.
 *
 * This is a journey — not analytics.
 * Never shows percentages or scores.
 */
export function CommercialReadiness({
  workflowCtx,
  className,
}: {
  workflowCtx: WorkflowContext;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5">
        Commercial journey
      </p>
      <ul className="space-y-2.5 pl-0.5">
        {JOURNEY_STEPS.map((step) => (
          <JourneyStepItem
            key={step.id}
            step={step}
            status={getStepStatus(step.id, workflowCtx.currentStage)}
          />
        ))}
      </ul>
    </div>
  );
}

/**
 * Compact inline readiness summary for use in cards or small surfaces.
 * Shows current stage + next stage only.
 */
export function CommercialReadinessCompact({
  workflowCtx,
  className,
}: {
  workflowCtx: WorkflowContext;
  className?: string;
}) {
  const doneCount = STAGE_ORDER.indexOf(workflowCtx.currentStage);
  const totalSteps = JOURNEY_STEPS.length;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex gap-0.5">
        {JOURNEY_STEPS.map((step) => {
          const status = getStepStatus(step.id, workflowCtx.currentStage);
          return (
            <div
              key={step.id}
              className={cn(
                'h-1.5 w-4 rounded-full',
                status === 'done' && 'bg-[rgb(29,111,66)]',
                status === 'current' && 'bg-[rgb(124,92,255)]',
                status === 'future' && 'bg-border/40'
              )}
              title={step.label}
            />
          );
        })}
      </div>
      <span className="text-xs text-muted-foreground">
        {doneCount}/{totalSteps}
      </span>
    </div>
  );
}
