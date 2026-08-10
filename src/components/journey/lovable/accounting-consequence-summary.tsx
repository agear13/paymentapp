'use client';

import type { AccountingConsequenceFlow } from '@/lib/accounting/accounting-removal-ux';

type AccountingConsequenceSummaryProps = {
  flow: AccountingConsequenceFlow;
  className?: string;
};

export function AccountingConsequenceSummary({
  flow,
  className = '',
}: AccountingConsequenceSummaryProps) {
  return (
    <div
      className={`rounded-lg border border-border/80 bg-background/80 px-3 py-2.5 ${className}`}
      aria-label="What happens"
    >
      <div className="space-y-1">
        {flow.steps.map((step, index) => (
          <div key={step.label}>
            {index > 0 ? (
              <div className="flex justify-center py-0.5 text-[11px] text-ink-soft" aria-hidden>
                ↓
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-3 text-[12px]">
              <span className="font-medium text-foreground">{step.label}</span>
              <span className="text-ink-soft">{step.value}</span>
            </div>
          </div>
        ))}
        <div className="flex justify-center py-0.5 text-[11px] text-ink-soft" aria-hidden>
          ↓
        </div>
        <p className="text-center text-[11.5px] text-ink-soft">{flow.footer}</p>
      </div>
    </div>
  );
}
