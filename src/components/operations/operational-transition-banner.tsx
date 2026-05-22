'use client';

import type { TransitionExplanation } from '@/lib/operations/explainability';

export type OperationalTransitionBannerProps = {
  transition: TransitionExplanation | null;
};

export function OperationalTransitionBanner({ transition }: OperationalTransitionBannerProps) {
  if (!transition) return null;

  return (
    <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-sm space-y-2">
      <p className="font-medium">{transition.title}</p>
      <p className="text-xs text-muted-foreground">
        {transition.fromState} → {transition.toState}
      </p>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Why</p>
      <ul className="space-y-1">
        {transition.reasons.map((r) => (
          <li key={r} className="flex gap-2 text-foreground/90">
            <span className="text-muted-foreground">•</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
