'use client';

import { cn } from '@/lib/utils';
import { formatCompactCurrency } from '@/lib/formatters/format-currency';
import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability/types';

type MoneyWaitingPanelProps = {
  releaseConfidence: ReleaseConfidenceSnapshot | null;
  loading?: boolean;
};

type MoneyCard = {
  label: string;
  amount: number | null;
  currency: string;
  tone: 'urgent' | 'pending' | 'positive' | 'neutral';
  emptyText: string;
};

/* ─── Component ─── */

/**
 * Money Waiting — the most important section for an operator.
 * Operators care about money, not health scores.
 * Four states: collected, held for obligations, ready to release, held back.
 */
export function MoneyWaitingPanel({
  releaseConfidence,
  loading,
}: MoneyWaitingPanelProps) {
  if (loading) {
    return (
      <section aria-label="Money" className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">Money</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl border border-border/60 bg-muted/15 animate-pulse"
            />
          ))}
        </div>
      </section>
    );
  }

  const currency = releaseConfidence?.currency ?? 'AUD';

  const cards: MoneyCard[] = [
    {
      label: 'Waiting to collect',
      amount: releaseConfidence?.collectedRevenue ?? null,
      currency,
      tone: 'pending',
      emptyText: 'No revenue yet. Revenue appears once agreements begin collecting payments.',
    },
    {
      label: 'Waiting for approvals',
      amount: releaseConfidence?.reservedObligations ?? null,
      currency,
      tone: 'urgent',
      emptyText: 'No payments awaiting approval.',
    },
    {
      label: 'Ready to release',
      amount: releaseConfidence?.readyToRelease ?? null,
      currency,
      tone: 'positive',
      emptyText: 'Nothing ready to release yet.',
    },
    {
      label: 'Under review',
      amount: releaseConfidence?.heldBack ?? null,
      currency,
      tone: 'neutral',
      emptyText: 'No payments on hold.',
    },
  ];

  return (
    <section aria-label="Money" className="space-y-2.5">
      <h2 className="text-sm font-semibold text-foreground">Money</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((card) => (
          <MoneyCard key={card.label} {...card} />
        ))}
      </div>
    </section>
  );
}

function MoneyCard({
  label,
  amount,
  currency,
  tone,
  emptyText,
}: MoneyCard) {
  const hasValue = amount !== null && amount > 0;

  const amountColor = {
    urgent: 'text-amber-700',
    pending: 'text-foreground',
    positive: 'text-[rgb(29,111,66)]',
    neutral: 'text-muted-foreground',
  }[tone];

  const borderColor = {
    urgent: hasValue ? 'border-amber-200/70' : 'border-border/50',
    pending: hasValue ? 'border-border/70' : 'border-border/50',
    positive: hasValue ? 'border-[rgba(29,111,66,0.2)]' : 'border-border/50',
    neutral: 'border-border/50',
  }[tone];

  const bgColor = {
    urgent: hasValue ? 'bg-amber-50/50' : 'bg-white/50',
    pending: 'bg-white/60',
    positive: hasValue ? 'bg-[rgba(29,111,66,0.03)]' : 'bg-white/50',
    neutral: 'bg-white/40',
  }[tone];

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-4 flex flex-col justify-between gap-2 min-h-[96px]',
        borderColor,
        bgColor
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 leading-tight">
        {label}
      </p>

      {hasValue ? (
        <p className={cn('text-xl font-semibold tabular-nums leading-none', amountColor)}>
          {formatCompactCurrency(amount!, currency)}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground/60 leading-snug">{emptyText}</p>
      )}
    </div>
  );
}
