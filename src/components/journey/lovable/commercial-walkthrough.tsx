'use client';

import Link from 'next/link';
import { ArrowRight, Brain, Check, Loader2, X } from 'lucide-react';
import {
  COMMERCIAL_WALKTHROUGH_COMPLETION,
  COMMERCIAL_WALKTHROUGH_STEPS,
  COMMERCIAL_WALKTHROUGH_STORAGE_KEY,
  COMMERCIAL_WALKTHROUGH_WELCOME,
  type CommercialWalkthroughPhase,
  type CommercialWalkthroughStep,
} from '@/lib/journey/commercial-walkthrough-steps';

type CommercialWalkthroughProps = {
  phase: CommercialWalkthroughPhase;
  stepIndex: number;
  onStartTour: () => void;
  onStepChange: (index: number) => void;
  onSkip: () => void;
  onContinue: (step: CommercialWalkthroughStep) => void;
  onCompleteAction: () => void;
};

function AiPresence({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'mb-3'}`}>
      <div
        className={`grid place-items-center rounded-xl bg-gradient-purple text-primary-foreground shadow-glow ${
          compact ? 'h-8 w-8' : 'h-9 w-9'
        }`}
      >
        <Brain className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      </div>
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground">
          Provvy AI
        </div>
        {!compact ? (
          <div className="text-[12px] text-ink-soft">Your commercial operating partner</div>
        ) : null}
      </div>
    </div>
  );
}

function AiActivityState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-primary/20 bg-accent/50 px-3.5 py-2.5">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
      <div>
        <div className="text-[10.5px] font-medium uppercase tracking-wider text-accent-foreground">
          Provvy AI is working
        </div>
        <div className="text-[12.5px] font-medium text-foreground">{label}</div>
      </div>
    </div>
  );
}

function WalkthroughWelcome({ onStartTour, onSkip }: { onStartTour: () => void; onSkip: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 animate-fade-up">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-primary/25 bg-card p-6 shadow-glow sm:p-8">
        <AiPresence />
        <h2 className="mt-5 text-2xl font-semibold tracking-[-0.02em]">
          {COMMERCIAL_WALKTHROUGH_WELCOME.title}
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
          {COMMERCIAL_WALKTHROUGH_WELCOME.body}
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onStartTour}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-purple px-5 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01]"
          >
            {COMMERCIAL_WALKTHROUGH_WELCOME.cta}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-xl border border-border px-4 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}

function WalkthroughCompletion({ onAction }: { onAction: () => void }) {
  const completion = COMMERCIAL_WALKTHROUGH_COMPLETION;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 animate-fade-up">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-primary/25 bg-card p-6 shadow-glow sm:p-8">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
          <Check className="h-3 w-3" />
          Workflow complete
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-[-0.02em]">{completion.title}</h2>
        <p className="mt-4 text-[13px] font-medium text-foreground">{completion.subtitle}</p>
        <ul className="mt-3 space-y-2">
          {completion.outcomes.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-[13px] text-foreground">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-8 border-t border-border pt-6">
          <div className="text-[13px] font-semibold text-foreground">{completion.nextPrompt}</div>
          <div className="mt-3 flex flex-col gap-2.5">
            {completion.actions.map((action) =>
              'external' in action && action.external ? (
                <a
                  key={action.label}
                  href={action.href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={onAction}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
                >
                  {action.label}
                </a>
              ) : (
                <Link
                  key={action.label}
                  href={action.href}
                  onClick={onAction}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-transform hover:scale-[1.01] ${
                    action.label === 'Start Your Assessment'
                      ? 'bg-gradient-purple text-primary-foreground shadow-glow'
                      : 'border border-border bg-background font-medium text-foreground hover:bg-accent'
                  }`}
                >
                  {action.label}
                  {action.label === 'Start Your Assessment' ? (
                    <ArrowRight className="h-3.5 w-3.5" />
                  ) : null}
                </Link>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WalkthroughActive({
  stepIndex,
  step,
  onStepChange,
  onSkip,
  onContinue,
}: {
  stepIndex: number;
  step: CommercialWalkthroughStep;
  onStepChange: (index: number) => void;
  onSkip: () => void;
  onContinue: (step: CommercialWalkthroughStep) => void;
}) {
  const isLast = stepIndex >= COMMERCIAL_WALKTHROUGH_STEPS.length - 1;

  return (
    <div className="fixed inset-x-0 bottom-6 z-[60] mx-auto w-[min(640px,calc(100%-2rem))] animate-fade-up">
      <div className="overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-glow">
        <div className="border-b border-border bg-gradient-to-br from-accent/60 to-transparent px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <AiPresence compact />
              <div className="mt-3 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                Commercial Workflow
              </div>
              <div className="mt-0.5 text-[13px] font-semibold text-foreground">
                Stage {step.stageNumber} of {COMMERCIAL_WALKTHROUGH_STEPS.length}
              </div>
              <div className="mt-0.5 text-[12.5px] text-ink-soft">{step.stageLabel}</div>
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-ink-soft transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Exit guided experience"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-1">
            {COMMERCIAL_WALKTHROUGH_STEPS.map((entry, index) => (
              <span
                key={entry.id}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  index <= stepIndex ? 'bg-primary' : 'bg-secondary'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="text-[14px] leading-relaxed text-foreground">{step.guidance}</p>

          <AiActivityState label={step.aiActivity} />

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => onContinue(step)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-purple px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01]"
            >
              {isLast ? 'View completion' : 'Continue'}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="rounded-xl border border-border px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
            >
              Exit
            </button>
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={() => onStepChange(stepIndex - 1)}
                className="rounded-xl px-4 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:bg-accent hover:text-foreground"
              >
                Back
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommercialWalkthrough({
  phase,
  stepIndex,
  onStartTour,
  onStepChange,
  onSkip,
  onContinue,
  onCompleteAction,
}: CommercialWalkthroughProps) {
  if (phase === 'welcome') {
    return <WalkthroughWelcome onStartTour={onStartTour} onSkip={onSkip} />;
  }

  if (phase === 'complete') {
    return <WalkthroughCompletion onAction={onCompleteAction} />;
  }

  const step = COMMERCIAL_WALKTHROUGH_STEPS[stepIndex];
  if (!step) return null;

  return (
    <WalkthroughActive
      stepIndex={stepIndex}
      step={step}
      onStepChange={onStepChange}
      onSkip={onSkip}
      onContinue={onContinue}
    />
  );
}

export function dismissCommercialWalkthrough(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(COMMERCIAL_WALKTHROUGH_STORAGE_KEY, 'true');
  }
}

export function isCommercialWalkthroughDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(COMMERCIAL_WALKTHROUGH_STORAGE_KEY) === 'true';
}

export function resetCommercialWalkthroughDismissed(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(COMMERCIAL_WALKTHROUGH_STORAGE_KEY);
  }
}
