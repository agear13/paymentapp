'use client';

import { useEffect, useState } from 'react';
import { Check, PartyPopper } from 'lucide-react';

type RevealStep = 'hidden' | 'headline' | 'condition' | 'due' | 'ready';

type Props = {
  active: boolean;
  paymentDueLabel: string;
  fastMode?: boolean;
  onCollectionReady: () => void;
};

function stepDelayMs(fastMode: boolean, step: Exclude<RevealStep, 'hidden'>): number {
  if (fastMode) {
    switch (step) {
      case 'headline':
        return 200;
      case 'condition':
        return 500;
      case 'due':
        return 850;
      case 'ready':
        return 1200;
    }
  }
  switch (step) {
    case 'headline':
      return 350;
    case 'condition':
      return 800;
    case 'due':
      return 1300;
    case 'ready':
      return 1850;
  }
}

export function HackathonMilestoneCollectionStatus({
  active,
  paymentDueLabel,
  fastMode = false,
  onCollectionReady,
}: Props) {
  const [step, setStep] = useState<RevealStep>('hidden');

  useEffect(() => {
    if (!active) {
      setStep('hidden');
      return;
    }

    let cancelled = false;
    const timeouts: number[] = [];
    const schedule = (next: RevealStep, ms: number) => {
      timeouts.push(
        window.setTimeout(() => {
          if (!cancelled) setStep(next);
        }, ms),
      );
    };

    setStep('hidden');
    schedule('headline', stepDelayMs(fastMode, 'headline'));
    schedule('condition', stepDelayMs(fastMode, 'condition'));
    schedule('due', stepDelayMs(fastMode, 'due'));
    schedule('ready', stepDelayMs(fastMode, 'ready'));

    timeouts.push(
      window.setTimeout(() => {
        if (!cancelled) onCollectionReady();
      }, stepDelayMs(fastMode, 'ready')),
    );

    return () => {
      cancelled = true;
      timeouts.forEach((id) => window.clearTimeout(id));
    };
  }, [active, fastMode, onCollectionReady]);

  if (step === 'hidden') return null;

  const showCondition = step === 'condition' || step === 'due' || step === 'ready';
  const showDue = step === 'due' || step === 'ready';

  return (
    <div className="mt-6 space-y-4 border-t border-border/60 pt-6">
      <div
        className={`transition-all duration-500 ${
          step !== 'hidden' ? 'animate-fade-up opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <PartyPopper className="h-4 w-4 text-primary" />
          Milestone achieved
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
          Provvy recognised that the agreement&apos;s contractual condition has been satisfied.
          Collection is now due under the terms you imported — not triggered manually.
        </p>
      </div>

      <div className="h-px bg-border/70" />

      <div className="space-y-3">
        <div
          className={`transition-all duration-500 ${
            showCondition ? 'animate-fade-up translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          <div className="flex items-center gap-2 text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">
            <Check className="h-4 w-4 shrink-0" />
            Contractual condition satisfied
          </div>
          <p className="mt-1 pl-6 text-[12px] text-ink-soft">
            2,000 validated ticket sales reached · agreement milestone criteria met
          </p>
        </div>

        <div
          className={`transition-all duration-500 ${
            showDue ? 'animate-fade-up translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          <div className="rounded-xl border border-primary/25 bg-accent/40 px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
              Agreement progression
            </div>
            <div className="mt-1 text-[15px] font-semibold tracking-tight">{paymentDueLabel}</div>
            <p className="mt-1 text-[12px] text-ink-soft">
              Pinch will collect this milestone tranche now that the agreement permits it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
