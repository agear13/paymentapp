'use client';

import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CommercialLifecycleStep, CommercialStepStatus } from '@/lib/participant-portal/participant-portal-types';

function StepIcon({ status }: { status: CommercialStepStatus }) {
  switch (status) {
    case 'complete':
      return <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />;
    case 'active':
      return <Clock className="h-4 w-4 text-amber-500 shrink-0" />;
    case 'waiting':
      return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />;
  }
}

type Props = {
  steps: CommercialLifecycleStep[];
  title?: string;
  className?: string;
};

export function CommercialLifecycleCard({
  steps,
  title = 'Commercial Lifecycle',
  className,
}: Props) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2.5">
          {steps.map((step) => (
            <li key={step.id} className="flex items-center gap-3">
              <StepIcon status={step.status} />
              <span
                className={cn(
                  'text-sm',
                  step.status === 'complete' && 'text-foreground',
                  step.status === 'active' && 'font-medium text-foreground',
                  (step.status === 'pending' || step.status === 'waiting') && 'text-muted-foreground'
                )}
              >
                {step.label}
                {step.status === 'complete' ? ' ✓' : ''}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
