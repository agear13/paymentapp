import type { CalendarEventCategory } from '@/lib/calendar/types';

export const CALENDAR_CATEGORY_META: Record<
  CalendarEventCategory,
  { label: string; dotClass: string; amountPrefix: string }
> = {
  expected_revenue: {
    label: 'Expected revenue',
    dotClass: 'bg-emerald-500/70',
    amountPrefix: '+',
  },
  money_outgoing: {
    label: 'Money going out',
    dotClass: 'bg-orange-400/80',
    amountPrefix: '-',
  },
  project_milestone: {
    label: 'Project milestone',
    dotClass: 'bg-violet-400/80',
    amountPrefix: '',
  },
  operational_task: {
    label: 'Operational task',
    dotClass: 'bg-sky-400/80',
    amountPrefix: '',
  },
};

export function formatCalendarAmount(
  amount: number | null,
  currency: string | null,
  direction: 'incoming' | 'outgoing' | 'neutral'
): string | null {
  if (amount == null || !currency) return null;
  const prefix = direction === 'incoming' ? '+' : direction === 'outgoing' ? '-' : '';
  return `${prefix} ${currency} ${amount.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
}
