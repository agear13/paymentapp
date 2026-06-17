'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReadinessCertainty } from '@/lib/onboarding/onboarding-assistant-copy';

type OnboardingCertaintyBadgeProps = {
  label: ReadinessCertainty | string;
  sublabel?: string;
  variant?: 'readiness' | 'neutral';
  className?: string;
  pulse?: boolean;
};

export function OnboardingCertaintyBadge({
  label,
  sublabel,
  variant = 'readiness',
  className,
  pulse = false,
}: OnboardingCertaintyBadgeProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1.5 text-center min-w-[7rem]',
        pulse && 'animate-in zoom-in-95 duration-300',
        className
      )}
    >
      <div
        className={cn(
          'rounded-full px-4 py-2 text-sm font-semibold border',
          variant === 'readiness'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-[rgba(124,92,255,0.2)] bg-[rgba(124,92,255,0.08)] text-[rgb(124,92,255)]'
        )}
      >
        {label}
      </div>
      {sublabel ? (
        <p className="text-[11px] text-muted-foreground max-w-[8rem] leading-snug">{sublabel}</p>
      ) : null}
    </div>
  );
}

type OnboardingOutcomeHighlightsProps = {
  items: string[];
  className?: string;
};

export function OnboardingOutcomeHighlights({ items, className }: OnboardingOutcomeHighlightsProps) {
  if (items.length === 0) return null;

  return (
    <ul
      className={cn(
        'flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-emerald-200/60 bg-emerald-50/40 px-4 py-3',
        className
      )}
    >
      {items.map((item) => (
        <li key={item} className="flex items-center gap-1.5 text-sm text-emerald-950">
          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden />
          {item}
        </li>
      ))}
    </ul>
  );
}
