'use client';

import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  deriveParticipantCommercialLifecycle,
  LIFECYCLE_TIMELINE_STEPS,
  lifecycleStageIndex,
  type ParticipantCommercialLifecycleStage,
} from '@/lib/commercial/participant-commercial-lifecycle';
import { cn } from '@/lib/utils';

type Props = {
  participant: DemoParticipant;
  compact?: boolean;
  className?: string;
};

function stepStatus(
  current: ParticipantCommercialLifecycleStage,
  stepStage: ParticipantCommercialLifecycleStage
): 'complete' | 'active' | 'pending' {
  const currentIdx = lifecycleStageIndex(current);
  const stepIdx = lifecycleStageIndex(stepStage);

  // Map PAYMENT_INFO_SUBMITTED to OPERATOR_REVIEW on timeline
  const normalizedCurrent =
    current === 'PAYMENT_INFO_SUBMITTED' ? 'OPERATOR_REVIEW' : current;
  const normalizedIdx = lifecycleStageIndex(normalizedCurrent);

  if (stepStage === 'OPERATOR_REVIEW' && current === 'PAYMENT_INFO_SUBMITTED') {
    return 'active';
  }
  if (normalizedIdx > stepIdx) return 'complete';
  if (normalizedIdx === stepIdx) return 'active';
  return 'pending';
}

function StepIcon({ status }: { status: 'complete' | 'active' | 'pending' }) {
  if (status === 'complete') {
    return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />;
  }
  if (status === 'active') {
    return <Clock className="h-4 w-4 text-amber-500 shrink-0" />;
  }
  return <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />;
}

/**
 * Visual participant lifecycle timeline for operator profile surfaces.
 */
export function ParticipantLifecycleTimeline({ participant, compact, className }: Props) {
  const current = deriveParticipantCommercialLifecycle(participant);

  if (compact) {
    const activeStep = LIFECYCLE_TIMELINE_STEPS.find(
      (s) => stepStatus(current, s.stage) === 'active'
    );
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        {activeStep?.label ?? 'In progress'}
      </p>
    );
  }

  return (
    <nav className={cn('space-y-0', className)} aria-label="Participant lifecycle">
      <ol className="relative border-l border-border ml-2 space-y-4 pl-6">
        {LIFECYCLE_TIMELINE_STEPS.map((step) => {
          const status = stepStatus(current, step.stage);
          return (
            <li key={step.stage} className="relative">
              <span
                className={cn(
                  'absolute -left-[25px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-background',
                  status === 'active' && 'ring-2 ring-amber-200'
                )}
              >
                <StepIcon status={status} />
              </span>
              <p
                className={cn(
                  'text-sm',
                  status === 'complete' && 'text-foreground',
                  status === 'active' && 'font-medium text-foreground',
                  status === 'pending' && 'text-muted-foreground/70'
                )}
              >
                {step.label}
              </p>
              {status === 'active' && current === 'OPERATOR_REVIEW' && step.stage === 'OPERATOR_REVIEW' && (
                <p className="text-xs text-amber-700 mt-0.5 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Action required
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
