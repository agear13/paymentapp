'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  readinessCertaintyLabel,
  readinessImprovedLabel,
  type ReadinessCertainty,
} from '@/lib/onboarding/onboarding-assistant-copy';
import { OnboardingCertaintyBadge } from '@/components/onboarding/onboarding-certainty-badge';

type OnboardingReadinessPreviewProps = {
  score: number;
  explanation: string;
  winMessage?: string | null;
  previousScore?: number;
  className?: string;
};

export function OnboardingReadinessPreview({
  score,
  explanation,
  winMessage,
  previousScore,
  className,
}: OnboardingReadinessPreviewProps) {
  const [displayLabel, setDisplayLabel] = React.useState<ReadinessCertainty>(
    readinessCertaintyLabel(score)
  );
  const [pulse, setPulse] = React.useState(false);

  React.useEffect(() => {
    const next = readinessCertaintyLabel(score);
    if (next === displayLabel) return;
    setPulse(true);
    setDisplayLabel(next);
    const timer = window.setTimeout(() => setPulse(false), 600);
    return () => window.clearTimeout(timer);
  }, [score, displayLabel]);

  const previousLabel =
    previousScore != null ? readinessCertaintyLabel(previousScore) : null;
  const improved =
    previousLabel != null ? readinessImprovedLabel(previousLabel, displayLabel) : null;

  return (
    <div
      className={cn(
        'rounded-lg border border-[rgba(124,92,255,0.12)] bg-white px-4 py-3 space-y-2 transition-shadow duration-300',
        pulse && 'shadow-md shadow-[rgba(124,92,255,0.12)]',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Agreement status</p>
          <p className="text-xs text-muted-foreground mt-0.5">{explanation}</p>
        </div>
        <OnboardingCertaintyBadge label={displayLabel} pulse={pulse} />
      </div>
      {winMessage ? (
        <p className="flex items-center gap-1.5 text-xs text-emerald-700 animate-in fade-in slide-in-from-bottom-1 duration-300">
          <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {winMessage}
          {improved ? <span className="text-muted-foreground">· {improved}</span> : null}
        </p>
      ) : null}
    </div>
  );
}
