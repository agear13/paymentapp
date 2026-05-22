'use client';

import { CheckCircle2, AlertCircle, HelpCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrustSignal, TrustLevel } from '@/lib/operations/explainability';

export type OperationalTrustIndicatorsProps = {
  signals: TrustSignal[];
  className?: string;
  compact?: boolean;
};

function iconFor(status: TrustLevel) {
  switch (status) {
    case 'healthy':
      return CheckCircle2;
    case 'attention':
      return AlertCircle;
    case 'risk':
      return XCircle;
    default:
      return HelpCircle;
  }
}

function iconClass(status: TrustLevel) {
  switch (status) {
    case 'healthy':
      return 'text-emerald-600';
    case 'attention':
      return 'text-amber-600';
    case 'risk':
      return 'text-red-600/90';
    default:
      return 'text-muted-foreground';
  }
}

export function OperationalTrustIndicators({
  signals,
  className,
  compact,
}: OperationalTrustIndicatorsProps) {
  if (signals.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        Trust indicators will appear as coordination setup progresses.
      </p>
    );
  }

  return (
    <ul
      className={cn(
        compact ? 'flex flex-wrap gap-x-4 gap-y-2' : 'space-y-2',
        className
      )}
      aria-label="Operational trust indicators"
    >
      {signals.map((s) => {
        const Icon = iconFor(s.status);
        return (
          <li
            key={s.id}
            className={cn(
              'flex items-start gap-2 text-sm',
              compact && 'items-center'
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', iconClass(s.status))} />
            <div className="min-w-0">
              <span className="font-medium text-foreground/90">{s.label}</span>
              {s.detail && !compact ? (
                <p className="text-xs text-muted-foreground">{s.detail}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
