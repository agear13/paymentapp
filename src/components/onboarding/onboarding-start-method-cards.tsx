'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ONBOARDING_START_METHODS,
  type OnboardingStartMethodId,
} from '@/lib/onboarding/operator-onboarding-types';
import { ClipboardList, FileDown, PenLine, Loader2 } from 'lucide-react';

const METHOD_ICONS: Record<OnboardingStartMethodId, React.ComponentType<{ className?: string }>> = {
  import: FileDown,
  create: PenLine,
  template: ClipboardList,
};

function CapabilityChips({ chips }: { chips: readonly string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Capabilities">
      {chips.map((chip) => (
        <li key={chip}>
          <span className="inline-flex items-center rounded-full border border-[rgba(124,92,255,0.14)] bg-[rgba(124,92,255,0.05)] px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {chip}
          </span>
        </li>
      ))}
    </ul>
  );
}

type OnboardingStartMethodCardsProps = {
  selectedMethod: OnboardingStartMethodId | null;
  onSelectMethod: (method: OnboardingStartMethodId) => void;
  onContinue: (method: OnboardingStartMethodId) => void;
  isMethodBlocked: (method: OnboardingStartMethodId) => boolean;
  continuing?: boolean;
  csrfReady?: boolean;
};

export function OnboardingStartMethodCards({
  selectedMethod,
  onSelectMethod,
  onContinue,
  isMethodBlocked,
  continuing = false,
  csrfReady = true,
}: OnboardingStartMethodCardsProps) {
  return (
    <div className="grid gap-4">
      {ONBOARDING_START_METHODS.map((item) => {
        const Icon = METHOD_ICONS[item.id];
        const isSelected = selectedMethod === item.id;
        const blocked = isMethodBlocked(item.id);

        return (
          <article
            key={item.id}
            role="group"
            aria-labelledby={`start-method-${item.id}-title`}
            className={cn(
              'rounded-xl border bg-white p-5 transition-all duration-200',
              isSelected
                ? 'border-[rgb(124,92,255)] ring-2 ring-[rgba(124,92,255,0.12)] shadow-sm'
                : 'border-[rgba(124,92,255,0.12)] hover:border-[rgba(124,92,255,0.25)] hover:shadow-sm',
              blocked && 'opacity-50'
            )}
          >
            <button
              type="button"
              disabled={blocked}
              onClick={() => onSelectMethod(item.id)}
              className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(124,92,255)] focus-visible:ring-offset-2 rounded-lg -m-1 p-1"
              aria-pressed={isSelected}
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(124,92,255,0.08)] text-[rgb(124,92,255)]"
                  aria-hidden
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p
                      id={`start-method-${item.id}-title`}
                      className="text-base font-semibold text-foreground"
                    >
                      {item.headline}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 leading-snug">
                      {item.description}
                    </p>
                  </div>
                  <CapabilityChips chips={item.chips} />
                  <p className="text-xs font-medium text-muted-foreground">{item.timeEstimate}</p>
                </div>
              </div>
            </button>
            <Button
              type="button"
              className="w-full h-11 mt-4"
              disabled={!csrfReady || blocked || continuing}
              onClick={() => onContinue(item.id)}
              aria-label={`${item.cta} — ${item.headline}`}
            >
              {continuing && selectedMethod === item.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {item.cta}
            </Button>
          </article>
        );
      })}
    </div>
  );
}
