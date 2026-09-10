import type { TimelineLayer } from '@/lib/workspace-timeline/types';

export const TIMELINE_LAYER_META: Record<
  TimelineLayer,
  { label: string; badgeClass: string; dotClass: string }
> = {
  commercial: {
    label: 'Commercial',
    badgeClass: 'bg-blue-500/[0.08] text-blue-800 border-blue-500/20 dark:text-blue-400',
    dotClass: 'bg-blue-500/70',
  },
  accounting: {
    label: 'Accounting',
    badgeClass: 'bg-violet-500/[0.08] text-violet-800 border-violet-500/20 dark:text-violet-400',
    dotClass: 'bg-violet-500/70',
  },
  settlement: {
    label: 'Settlement',
    badgeClass: 'bg-emerald-500/[0.08] text-emerald-800 border-emerald-500/20 dark:text-emerald-400',
    dotClass: 'bg-emerald-500/70',
  },
  operational: {
    label: 'Operational',
    badgeClass: 'bg-muted/60 text-muted-foreground border-border/80',
    dotClass: 'bg-muted-foreground/50',
  },
};

export function formatTimelineAmount(
  amount: number | null,
  currency: string | null,
  direction: 'incoming' | 'outgoing' | 'neutral'
): string | null {
  if (amount == null || !currency) return null;
  const prefix = direction === 'incoming' ? '+' : direction === 'outgoing' ? '-' : '';
  return `${prefix} ${currency} ${amount.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
}

export function layerForEventType(type: string): TimelineLayer {
  if (
    type.includes('invoice') ||
    type.includes('payment') ||
    type.includes('expected') ||
    type.includes('funding') ||
    type.includes('budget') ||
    type.includes('cash_shortfall') ||
    type.includes('commercial_risk')
  ) {
    return 'commercial';
  }
  if (type.includes('accounting') || type.includes('synced')) return 'accounting';
  if (type.includes('settlement') || type.includes('obligation')) return 'settlement';
  return 'operational';
}
