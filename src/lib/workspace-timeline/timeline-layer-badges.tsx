'use client';

import type { TimelineLayer } from '@/lib/workspace-timeline/types';
import { cn } from '@/lib/utils';

export const TIMELINE_LAYER_META: Record<
  TimelineLayer,
  { label: string; badgeClass: string; dotClass: string }
> = {
  commercial: {
    label: 'Commercial',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
    dotClass: 'bg-blue-500/70',
  },
  accounting: {
    label: 'Accounting',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200/80',
    dotClass: 'bg-violet-500/70',
  },
  settlement: {
    label: 'Settlement',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    dotClass: 'bg-emerald-500/70',
  },
  operational: {
    label: 'Operational',
    badgeClass: 'bg-muted/60 text-muted-foreground border-border/80',
    dotClass: 'bg-muted-foreground/50',
  },
};

export function TimelineLayerBadge({ layer, className }: { layer: TimelineLayer; className?: string }) {
  const meta = TIMELINE_LAYER_META[layer];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
        meta.badgeClass,
        className
      )}
    >
      {meta.label}
    </span>
  );
}

export function formatTimelineAmount(
  amount: number | null,
  currency: string | null,
  direction: 'incoming' | 'outgoing' | 'neutral'
): string | null {
  if (amount == null || !currency) return null;
  const prefix = direction === 'incoming' ? '+' : direction === 'outgoing' ? '-' : '';
  return `${prefix} ${currency} ${amount.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
}
