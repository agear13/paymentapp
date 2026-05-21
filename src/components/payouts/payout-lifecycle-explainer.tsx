'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const LIFECYCLE_STEPS = [
  { title: 'Customer payment', detail: 'A successful payment creates payout obligations.' },
  { title: 'Obligation created', detail: 'Participant amounts are recorded and tracked.' },
  { title: 'Funding confirmed', detail: 'Project funding covers what is owed.' },
  { title: 'Participant approved', detail: 'Approvals and onboarding requirements are met.' },
  { title: 'Ready for payout', detail: 'Eligible to include in a release batch.' },
  { title: 'Release batch', detail: 'Grouped for treasury review and release.' },
  { title: 'Settled', detail: 'Funds released to participants.' },
] as const;

const HOW_IT_WORKS = [
  'Customer payments create payout obligations',
  'Approved and funded obligations become payout-ready',
  'Release batches send payouts to participants',
] as const;

export function PayoutHowItWorksCard() {
  return (
    <Card className="border-border/80 bg-muted/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">How payouts work</CardTitle>
        <CardDescription>
          A calm overview of how money moves from customer payment to participant payout.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3 text-sm">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <span className="pt-0.5 text-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export function PayoutLifecycleFlow({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {LIFECYCLE_STEPS.map((step, i) => (
          <span key={step.title} className="inline-flex items-center gap-1">
            <span className="font-medium text-foreground">{step.title}</span>
            {i < LIFECYCLE_STEPS.length - 1 ? (
              <ArrowRight className="h-3 w-3 opacity-50" aria-hidden />
            ) : null}
          </span>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Payout lifecycle</CardTitle>
        <CardDescription>
          Follow an obligation from payment through to settlement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-0 lg:flex-row lg:items-stretch lg:gap-2">
          {LIFECYCLE_STEPS.map((step, index) => (
            <div
              key={step.title}
              className={cn(
                'relative flex flex-1 flex-col rounded-lg border bg-background p-3 text-sm',
                index < LIFECYCLE_STEPS.length - 1 &&
                  'lg:after:content-[""] lg:after:absolute lg:after:-right-2 lg:after:top-1/2 lg:after:h-px lg:after:w-4'
              )}
            >
              <p className="font-medium text-foreground">{step.title}</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{step.detail}</p>
              {index < LIFECYCLE_STEPS.length - 1 ? (
                <ArrowRight
                  className="mt-2 h-4 w-4 text-muted-foreground lg:hidden"
                  aria-hidden
                />
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
