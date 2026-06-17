'use client';

import * as React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OperationalAuditEntry, OperationalAuditEventType } from '@/lib/operations/audit/operational-audit';

type BusinessMomentumProps = {
  auditEntries: OperationalAuditEntry[];
};

/* ─── Positive milestone types ─── */

const MILESTONE_LABELS: Partial<Record<OperationalAuditEventType, { headline: string; context: string }>> = {
  agreement_approved: {
    headline: 'Participant approved.',
    context: 'Agreement moved forward.',
  },
  stripe_connected: {
    headline: 'Payments are now live.',
    context: 'Your business can begin accepting customer payments.',
  },
  payment_rails_connected: {
    headline: 'Payments are now live.',
    context: 'Revenue collection is ready.',
  },
  payout_eligible: {
    headline: 'Participant is ready to be paid.',
    context: 'Payout obligations are confirmed.',
  },
  release_batch_generated: {
    headline: 'Payout released.',
    context: 'Settlement completed successfully.',
  },
  funding_linked: {
    headline: 'Revenue collection is configured.',
    context: 'Customers can now pay for this agreement.',
  },
  obligations_generated: {
    headline: 'Payment obligations are confirmed.',
    context: 'The agreement is ready for final approval.',
  },
};

const FRESH_WINDOW_MS = 90 * 60 * 1000; // 90 minutes — "just happened"

function findFreshMilestone(
  entries: OperationalAuditEntry[]
): OperationalAuditEntry | null {
  const cutoff = Date.now() - FRESH_WINDOW_MS;
  const milestoneTypes = Object.keys(MILESTONE_LABELS) as OperationalAuditEventType[];

  return (
    [...entries]
      .filter(
        (e) =>
          milestoneTypes.includes(e.type) &&
          new Date(e.timestamp).getTime() > cutoff
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] ?? null
  );
}

/**
 * Business Momentum — celebrates recent milestones automatically.
 * Surfaces the most recent positive event (within 90 min) as a success banner.
 * Auto-dismisses after 5 seconds. Makes small progress feel meaningful.
 */
export function BusinessMomentum({ auditEntries }: BusinessMomentumProps) {
  const [dismissed, setDismissed] = React.useState(false);

  const milestone = React.useMemo(
    () => findFreshMilestone(auditEntries),
    [auditEntries]
  );

  React.useEffect(() => {
    if (!milestone) return;
    setDismissed(false);
    const timer = setTimeout(() => setDismissed(true), 5000);
    return () => clearTimeout(timer);
  }, [milestone?.id]);

  if (!milestone || dismissed) return null;

  const labels = MILESTONE_LABELS[milestone.type];
  if (!labels) return null;

  const actorLine = milestone.actor ? ` ${milestone.actor} — ` : '';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-start gap-3 rounded-xl border border-[rgba(29,111,66,0.25)]',
        'bg-[rgba(29,111,66,0.05)] px-4 py-3',
        'animate-in fade-in slide-in-from-top-1 duration-300'
      )}
    >
      {/* Check icon */}
      <div className="h-5 w-5 rounded-full bg-[rgb(29,111,66)] flex items-center justify-center shrink-0 mt-0.5">
        <Check className="h-3 w-3 text-white" aria-hidden />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-snug">
          {labels.headline}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
          {actorLine}{labels.context}
        </p>
      </div>

      {/* Dismiss */}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors mt-0.5"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
