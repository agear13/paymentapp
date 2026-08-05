'use client';

import { ArrowDown } from 'lucide-react';
import type { PaymentFlowStep } from '@/lib/accounting/payment-account-recommendations';

type PaymentFlowDiagramProps = {
  steps: PaymentFlowStep[];
  className?: string;
};

export function PaymentFlowDiagram({ steps, className = '' }: PaymentFlowDiagramProps) {
  return (
    <div
      className={`rounded-lg border border-border/70 bg-muted/30 p-3 ${className}`}
      aria-label="Payment flow"
    >
      <p className="mb-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        How money flows
      </p>
      <ol className="flex flex-col items-stretch">
        {steps.map((step, index) => (
          <li key={`${step.label}-${index}`} className="flex flex-col items-center">
            <span
              className={`w-full rounded-md border border-border/60 bg-background px-2 py-1.5 text-center text-xs leading-snug ${
                step.optional
                  ? 'text-muted-foreground italic'
                  : index === steps.length - 1
                    ? 'font-medium text-foreground'
                    : 'text-foreground'
              }`}
            >
              {step.label}
              {step.optional ? ' (optional)' : ''}
            </span>
            {index < steps.length - 1 ? (
              <ArrowDown
                className="my-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
                aria-hidden
              />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
