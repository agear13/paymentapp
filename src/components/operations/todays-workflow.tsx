'use client';

import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { OperationalAction } from '@/lib/operations/explainability/types';

type TodaysWorkflowProps = {
  actions: OperationalAction[];
};

const URGENCY_MINUTES: Record<OperationalAction['urgency'], number> = {
  critical: 1,
  high: 2,
  medium: 5,
  low: 10,
};

function formatMinutes(n: number): string {
  return n === 1 ? '1 min' : `${n} mins`;
}

/** Ordered checklist of next steps — driven by Agreement Intelligence. */
export function TodaysWorkflow({ actions }: TodaysWorkflowProps) {
  const steps = actions.slice(0, 3);
  if (steps.length === 0) return null;

  return (
    <section aria-label="Today's workflow" className="space-y-2.5">
      <h2 className="text-sm font-semibold text-foreground">Today's workflow</h2>
      <div className="rounded-xl border border-border/60 bg-white/60 overflow-hidden divide-y divide-border/50">
        {steps.map((action, index) => (
          <WorkflowStep
            key={action.id}
            step={index + 1}
            action={action}
            isLast={index === steps.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

function WorkflowStep({
  step,
  action,
  isLast,
}: {
  step: number;
  action: OperationalAction;
  isLast: boolean;
}) {
  const minutes = URGENCY_MINUTES[action.urgency] ?? 2;

  return (
    <div className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/20 transition-colors duration-100 group">
      {/* Step number */}
      <div
        className={cn(
          'shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold border',
          action.urgency === 'critical'
            ? 'border-red-500/40 bg-red-50 text-red-700'
            : action.urgency === 'high'
              ? 'border-amber-500/40 bg-amber-50 text-amber-700'
              : 'border-border/70 bg-muted/30 text-muted-foreground'
        )}
      >
        {step}
      </div>

      {/* Action */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground leading-snug">{action.action}</p>
        {action.reason ? (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{action.reason}</p>
        ) : null}
      </div>

      {/* Time + CTA */}
      <div className="shrink-0 flex items-center gap-3">
        <span className="text-xs text-muted-foreground hidden sm:block">
          {formatMinutes(minutes)}
        </span>
        {action.destination ? (
          <Button asChild size="sm" variant="outline" className="h-7 text-xs shrink-0">
            <Link href={action.destination}>
              {action.ctaLabel ?? 'Start'}
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
