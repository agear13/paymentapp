'use client';

import * as React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ParticipantWorkspaceOnboardingStep } from '@/lib/participant-portal/participant-workspace-onboarding';

const STEPS: { id: ParticipantWorkspaceOnboardingStep; label: string }[] = [
  { id: 'agreement_review', label: 'Agreement' },
  { id: 'payout_details', label: 'Payout details' },
  { id: 'complete', label: 'Workspace' },
];

function stepIndex(step: ParticipantWorkspaceOnboardingStep): number {
  if (step === 'awaiting_agreement_send' || step === 'agreement_review') return 0;
  if (step === 'payout_details' || step === 'payout_submitted') return 1;
  return 2;
}

type Props = {
  currentStep: ParticipantWorkspaceOnboardingStep;
  nextRequiredAction: string | null;
  children: React.ReactNode;
};

export function ParticipantWorkspaceOnboardingProgress({ currentStep, nextRequiredAction, children }: Props) {
  const active = stepIndex(currentStep);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-background p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          {STEPS.map((step, index) => {
            const done = index < active;
            const current = index === active;
            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                  <div
                    className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold border',
                      done && 'bg-emerald-600 border-emerald-600 text-white',
                      current && !done && 'border-primary bg-primary/10 text-primary',
                      !done && !current && 'border-muted-foreground/30 text-muted-foreground'
                    )}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                  </div>
                  <span className="text-[10px] sm:text-xs text-muted-foreground text-center truncate w-full">
                    {step.label}
                  </span>
                </div>
                {index < STEPS.length - 1 ? (
                  <div
                    className={cn(
                      'h-px flex-1 mb-5',
                      index < active ? 'bg-emerald-500' : 'bg-border'
                    )}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
        {nextRequiredAction ? (
          <p className="text-sm text-foreground">
            <span className="font-medium">Next required action: </span>
            {nextRequiredAction}
          </p>
        ) : currentStep === 'payout_submitted' || currentStep === 'complete' ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            No further action required right now. Track your commercial relationship below.
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
