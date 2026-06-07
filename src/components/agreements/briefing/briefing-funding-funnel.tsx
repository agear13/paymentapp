'use client';

import { AlertTriangle, Check, Circle } from 'lucide-react';
import type {
  AgreementFundingFunnelStep,
  AgreementFundingFunnelStepStatus,
} from '@/lib/agreements/intelligence/agreement-intelligence.types';
import { BriefingSectionShell } from '@/components/agreements/briefing/briefing-section-shell';
import { cn } from '@/lib/utils';

type BriefingFundingFunnelProps = {
  steps: AgreementFundingFunnelStep[];
};

function StepIcon({ status }: { status: AgreementFundingFunnelStepStatus }) {
  if (status === 'complete') {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(29,111,66,0.12)] text-[rgb(29,111,66)]">
        <Check className="h-4 w-4" strokeWidth={2.5} />
      </span>
    );
  }
  if (status === 'attention') {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
        <AlertTriangle className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/25 text-muted-foreground/50">
      <Circle className="h-3 w-3" />
    </span>
  );
}

export function BriefingFundingFunnel({ steps }: BriefingFundingFunnelProps) {
  return (
    <BriefingSectionShell
      id="briefing-funnel"
      title="Coordination Progress"
      description="How this agreement moves from creation through funding, obligations, approvals, and settlement."
      variant="intelligence"
    >
      <ol className="relative space-y-0">
        {steps.map((step, index) => (
          <li key={step.id} className="relative flex gap-4 pb-6 last:pb-0">
            {index < steps.length - 1 ? (
              <span
                className={cn(
                  'absolute left-4 top-8 -ml-px h-[calc(100%-1rem)] w-0.5',
                  step.status === 'complete'
                    ? 'bg-[rgba(29,111,66,0.35)]'
                    : step.status === 'attention'
                      ? 'bg-amber-400/40'
                      : 'bg-border'
                )}
                aria-hidden
              />
            ) : null}
            <StepIcon status={step.status} />
            <div className="min-w-0 flex-1 pt-0.5">
              <p
                className={cn(
                  'font-semibold text-sm',
                  step.status === 'complete' && 'text-[rgb(29,111,66)]',
                  step.status === 'attention' && 'text-amber-800 dark:text-amber-300',
                  step.status === 'pending' && 'text-muted-foreground'
                )}
              >
                {step.label}
              </p>
              {step.detail ? (
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.detail}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </BriefingSectionShell>
  );
}
