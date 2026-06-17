'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type OnboardingSuccessMomentProps = {
  message: string;
  className?: string;
  compact?: boolean;
};

/** Lightweight progress confirmation — one line, no paragraph. */
export function OnboardingSuccessMoment({
  message,
  className,
  compact = false,
}: OnboardingSuccessMomentProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/80 text-emerald-900 animate-in fade-in slide-in-from-bottom-1 duration-300',
        compact ? 'px-3 py-2 text-sm' : 'px-4 py-3 text-sm',
        className
      )}
    >
      <Check className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
      <span className="font-medium">{message}</span>
    </div>
  );
}
