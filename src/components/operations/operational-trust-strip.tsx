'use client';

import { CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrustSignal } from '@/lib/operations/explainability';

export function OperationalTrustStrip({
  signals,
  className,
}: {
  signals: TrustSignal[];
  className?: string;
}) {
  if (signals.length === 0) return null;

  return (
    <ul
      className={cn(
        'flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground',
        className
      )}
      aria-label="Trust indicators"
    >
      {signals.slice(0, 5).map((s) => {
        const Icon =
          s.status === 'healthy'
            ? CheckCircle2
            : s.status === 'attention' || s.status === 'risk'
              ? AlertCircle
              : HelpCircle;
        return (
          <li key={s.id} className="flex items-center gap-1.5">
            <Icon
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                s.status === 'healthy' && 'text-emerald-600/80',
                (s.status === 'attention' || s.status === 'risk') && 'text-amber-600/80'
              )}
            />
            <span>{s.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
