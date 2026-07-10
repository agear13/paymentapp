import type { TimelineLayer } from '@/lib/workspace-timeline/types';

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
    badgeClass: 'bg-slate-50 text-slate-600 border-slate-200/80',
    dotClass: 'bg-slate-400/70',
  },
};

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
