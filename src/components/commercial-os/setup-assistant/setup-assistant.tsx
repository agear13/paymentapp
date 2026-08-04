'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, PartyPopper, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  GuidedSetupConfig,
  GuidedSetupPhase,
  GuidedSetupStep,
} from '@/lib/commercial-os/guided-setup';
import { guidedSetupStorageKey } from '@/lib/commercial-os/guided-setup';

const HIGHLIGHT_RING = 'ring-2';
const HIGHLIGHT_OFFSET = 'ring-offset-2';
const HIGHLIGHT_COLOR = 'ring-primary';
const HIGHLIGHT_BG = 'ring-offset-background';

type SetupAssistantProps = {
  config: GuidedSetupConfig;
  steps: GuidedSetupStep[];
  variant?: 'default' | 'commercial';
};

function readPhase(storageKey: string): GuidedSetupPhase | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (raw === 'dismissed') return 'dismissed';
    if (raw === 'complete') return 'complete';
    if (raw === 'active') return 'active';
  } catch {}
  return null;
}

function writePhase(storageKey: string, phase: GuidedSetupPhase) {
  try {
    sessionStorage.setItem(storageKey, phase);
  } catch {}
}

function clearHighlight() {
  document.querySelectorAll('[data-guided-highlight="true"]').forEach((el) => {
    el.removeAttribute('data-guided-highlight');
    el.classList.remove(HIGHLIGHT_RING, HIGHLIGHT_OFFSET, HIGHLIGHT_COLOR, HIGHLIGHT_BG);
  });
}

function highlightTarget(targetId: string) {
  clearHighlight();
  const el = document.getElementById(targetId);
  if (!el) return;
  el.setAttribute('data-guided-highlight', 'true');
  el.classList.add(HIGHLIGHT_RING, HIGHLIGHT_OFFSET, HIGHLIGHT_COLOR, HIGHLIGHT_BG);
  window.setTimeout(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 80);
}

/**
 * Generic Commercial OS setup assistant — orchestrates existing page sections
 * without locking navigation or duplicating production components.
 */
export function SetupAssistant({ config, steps, variant = 'default' }: SetupAssistantProps) {
  const phaseKey = guidedSetupStorageKey(config.id, 'phase');
  const stepKey = guidedSetupStorageKey(config.id, 'step');

  const [phase, setPhase] = useState<GuidedSetupPhase>('intro');
  const [stepIndex, setStepIndex] = useState(0);

  const visibleSteps = useMemo(() => steps.filter(Boolean), [steps]);
  const totalSteps = visibleSteps.length;
  const currentStep = visibleSteps[stepIndex];
  const progressPercent =
    phase === 'complete'
      ? 100
      : phase === 'active' && totalSteps > 0
        ? Math.round((stepIndex / totalSteps) * 100)
        : 0;

  useEffect(() => {
    const savedPhase = readPhase(phaseKey);
    if (savedPhase) setPhase(savedPhase);
    try {
      const savedStep = sessionStorage.getItem(stepKey);
      if (savedStep) setStepIndex(Number.parseInt(savedStep, 10) || 0);
    } catch {}
  }, [phaseKey, stepKey]);

  useEffect(() => {
    if (phase !== 'active' || !currentStep) {
      clearHighlight();
      return;
    }
    highlightTarget(currentStep.targetId);
    return () => clearHighlight();
  }, [phase, currentStep]);

  const persistPhase = useCallback(
    (next: GuidedSetupPhase) => {
      setPhase(next);
      writePhase(phaseKey, next);
    },
    [phaseKey]
  );

  const persistStep = useCallback(
    (index: number) => {
      setStepIndex(index);
      try {
        sessionStorage.setItem(stepKey, String(index));
      } catch {}
    },
    [stepKey]
  );

  const startSetup = () => {
    persistStep(0);
    persistPhase('active');
  };

  const continueStep = () => {
    if (stepIndex >= totalSteps - 1) {
      persistPhase('complete');
      clearHighlight();
      return;
    }
    persistStep(stepIndex + 1);
  };

  const dismiss = () => {
    clearHighlight();
    persistPhase('dismissed');
  };

  const restart = () => {
    persistStep(0);
    persistPhase('intro');
    try {
      sessionStorage.removeItem(stepKey);
    } catch {}
  };

  const isCommercial = variant === 'commercial';
  const cardClass = isCommercial
    ? 'rounded-2xl border border-border bg-card p-6 shadow-card'
    : 'rounded-lg border bg-card p-5';

  if (phase === 'dismissed') {
    return (
      <div className={`${cardClass} flex flex-wrap items-center justify-between gap-3`}>
        <p className="text-sm text-muted-foreground">
          Setup guide dismissed. You can browse settings freely or restart the walkthrough.
        </p>
        <Button size="sm" variant="outline" onClick={restart}>
          Restart setup guide
        </Button>
      </div>
    );
  }

  if (phase === 'complete') {
    const { completion } = config;
    return (
      <div className={`${cardClass} space-y-5`}>
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-xl">
            🎉
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{completion.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{completion.body}</p>
          </div>
        </div>
        <ul className="space-y-2 text-sm">
          {completion.bullets.map((line) => (
            <li key={line} className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              {line}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button asChild className={isCommercial ? 'rounded-xl' : undefined}>
            <Link href={completion.primaryAction.href}>
              {completion.primaryAction.label}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
          {completion.secondaryAction ? (
            <Button variant="outline" asChild className={isCommercial ? 'rounded-xl' : undefined}>
              <Link href={completion.secondaryAction.href}>{completion.secondaryAction.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (phase === 'active' && currentStep) {
    return (
      <div className={`${cardClass} space-y-4`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Step {stepIndex + 1} of {totalSteps}
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">{currentStep.title}</h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Dismiss setup guide"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{currentStep.explanation}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.max(progressPercent, 8)}%` }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={continueStep} className={isCommercial ? 'rounded-xl' : undefined}>
            {currentStep.continueLabel ?? 'Continue'}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={dismiss}>
            Dismiss guide
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${cardClass} space-y-4`}>
      <div className="flex items-start gap-3">
        <div
          className={
            isCommercial
              ? 'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary'
              : 'mt-0.5 text-primary'
          }
        >
          {isCommercial ? <Sparkles className="h-5 w-5" /> : <PartyPopper className="h-5 w-5" />}
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{config.introTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{config.introSubtitle}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Estimated time:</span>{' '}
            {config.estimatedTime}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>0%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-0 rounded-full bg-primary" />
        </div>
      </div>
      <Button onClick={startSetup} className={isCommercial ? 'rounded-xl' : undefined}>
        Start Setup
        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
