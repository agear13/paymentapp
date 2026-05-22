'use client';

import { CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrustSignal } from '@/lib/operations/explainability';
import { opTypeMeta } from '@/lib/design/operational-typography';

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
        'flex flex-wrap gap-x-4 gap-y-2 text-sm text-foreground/70',
        className
      )}
      aria-label="Trust indicators"
    >
      {signals.slice(0, 4).map((s) => {
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
                'h-4 w-4 shrink-0',
                s.status === 'healthy' && 'text-emerald-700/90 dark:text-emerald-400',
                (s.status === 'attention' || s.status === 'risk') && 'text-amber-700/80 dark:text-amber-400/90'
              )}
            />
            <span className={opTypeMeta}>{s.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
