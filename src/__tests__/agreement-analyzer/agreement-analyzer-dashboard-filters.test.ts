import {
  normalizeLeadListPage,
  parseDateFilter,
  parseLeadScoreRange,
} from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-filters';

describe('agreement analyzer dashboard filters', () => {
  it('parses lead score ranges', () => {
    expect(parseLeadScoreRange('0-39')).toEqual({ min: 0, max: 39 });
    expect(parseLeadScoreRange('90-100')).toEqual({ min: 90, max: 100 });
  });

  it('normalizes pagination pages', () => {
    expect(normalizeLeadListPage(undefined)).toBe(1);
    expect(normalizeLeadListPage(0)).toBe(1);
    expect(normalizeLeadListPage(3)).toBe(3);
  });

  it('parses valid date filters and rejects invalid values', () => {
    expect(parseDateFilter('2026-06-01')?.toISOString().slice(0, 10)).toBe('2026-06-01');
    expect(parseDateFilter('invalid')).toBeUndefined();
    expect(parseDateFilter(undefined)).toBeUndefined();
  });
});
