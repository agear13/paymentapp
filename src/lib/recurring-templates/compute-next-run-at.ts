import type { RecurringTemplateInterval } from '@prisma/client';

/**
 * Next occurrence after `anchor` (typically the `next_run_at` that just fired), in UTC calendar math.
 * - WEEKLY: add `7 * intervalCount` days
 * - MONTHLY: add `intervalCount` calendar months
 * - CUSTOM: add `intervalCount` days
 */
export function computeNextRunAt(
  anchor: Date,
  recurrence: RecurringTemplateInterval,
  intervalCount: number
): Date {
  const count = Math.max(1, intervalCount);
  const d = new Date(anchor.getTime());
  switch (recurrence) {
    case 'WEEKLY':
      d.setUTCDate(d.getUTCDate() + 7 * count);
      return d;
    case 'CUSTOM':
      d.setUTCDate(d.getUTCDate() + count);
      return d;
    case 'MONTHLY':
      d.setUTCMonth(d.getUTCMonth() + count);
      return d;
  }
}

export function nextRunExceedsEndDate(nextRun: Date, endDate: Date | null): boolean {
  if (!endDate) return false;
  const endUtc = new Date(
    Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
  return nextRun.getTime() > endUtc.getTime();
}
