import { formatRecurringIntervalLabel } from '@/lib/recurring-templates/format-recurring-interval-label';

describe('recurring interval labels (1G)', () => {
  it('formats weekly, monthly, and custom day intervals', () => {
    expect(formatRecurringIntervalLabel('weekly', 1)).toBe('Every week');
    expect(formatRecurringIntervalLabel('weekly', 3)).toBe('Every 3 weeks');
    expect(formatRecurringIntervalLabel('monthly', 2)).toBe('Every 2 months');
    expect(formatRecurringIntervalLabel('custom', 14)).toBe('Every 14 days');
  });
});
