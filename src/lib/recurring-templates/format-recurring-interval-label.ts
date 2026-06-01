export type RecurringIntervalKind = 'weekly' | 'monthly' | 'custom';

/** Human-readable schedule label aligned with backend interval support. */
export function formatRecurringIntervalLabel(
  interval: RecurringIntervalKind,
  intervalCount: number
): string {
  const n = Math.max(1, Math.floor(intervalCount) || 1);
  if (interval === 'weekly') {
    return n === 1 ? 'Every week' : `Every ${n} weeks`;
  }
  if (interval === 'monthly') {
    return n === 1 ? 'Every month' : `Every ${n} months`;
  }
  return n === 1 ? 'Every day' : `Every ${n} days`;
}
