'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import type { ContextualGuidance } from '@/lib/journey/contextual-guidance';

export function CreateInvoiceContextualGuidance({
  guidance,
}: {
  guidance: ContextualGuidance;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const continueAction = guidance.actions.find((action) => action.id === 'continue');
  const setupActions = guidance.actions.filter((action) => action.id !== 'continue');

  return (
    <aside className="rounded-2xl border border-primary/20 bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-purple text-primary-foreground shadow-glow">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[14px] font-semibold tracking-tight">Provvy AI Advisor</div>
            <div className="text-[11px] text-ink-soft">While you create this invoice</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="grid h-7 w-7 place-items-center rounded-lg text-ink-soft hover:bg-accent hover:text-foreground"
          aria-label="Dismiss guidance"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-4">
        <div className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground">
          Contextual guidance
        </div>
        <p className="mt-2 text-[15px] font-semibold tracking-tight">{guidance.title}</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{guidance.description}</p>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {continueAction ? (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground"
          >
            {continueAction.label}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {setupActions.map((action) =>
          action.href ? (
            <Link
              key={action.id}
              href={action.href}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2.5 text-[13px] font-medium text-foreground hover:border-primary/40 hover:bg-accent"
            >
              {action.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null
        )}
      </div>
    </aside>
  );
}
