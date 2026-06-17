'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TemplateSetupProgress } from '@/lib/onboarding/template-draft-state';

type OnboardingSetupProgressPanelProps = {
  templateTitle: string;
  setupTimeMinutes?: number;
  progress: TemplateSetupProgress;
  className?: string;
};

const SETUP_ITEMS = [
  { key: 'participantsComplete' as const, label: 'Participants' },
  { key: 'commercialTermsComplete' as const, label: 'Commercial Terms' },
  { key: 'settlementRulesComplete' as const, label: 'Payment rules' },
];

export function OnboardingSetupProgressPanel({
  templateTitle,
  setupTimeMinutes = 2,
  progress,
  className,
}: OnboardingSetupProgressPanelProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[rgba(124,92,255,0.15)] bg-white px-4 py-4 sm:px-5 space-y-3',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-foreground">{templateTitle}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Estimated setup · ≈ {setupTimeMinutes} minute{setupTimeMinutes === 1 ? '' : 's'}
          </p>
        </div>
        <p className="text-xs font-medium text-[rgb(124,92,255)] shrink-0">Complete before continuing</p>
      </div>
      <ul className="space-y-1.5">
        {SETUP_ITEMS.map(({ key, label }) => {
          const done = progress[key];
          return (
            <li key={key} className="flex items-center gap-2 text-sm">
              {done ? (
                <Check className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
              ) : (
                <span
                  className="h-4 w-4 rounded border border-[rgba(124,92,255,0.25)] shrink-0"
                  aria-hidden
                />
              )}
              <span className={done ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
