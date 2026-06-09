import {
  formatReportItem,
  readinessLabel,
  readinessTone,
} from '@/lib/agreement-analyzer/format-report-items';
import { isValidReportAccessToken } from '@/lib/agreement-analyzer/report-types';

describe('agreement-analyzer report presentation helpers', () => {
  it('formats object-shaped report items', () => {
    const formatted = formatReportItem({
      name: 'Acme Pty Ltd',
      role: 'Licensor',
      revenueSharePct: 15,
    });
    expect(formatted).toContain('Acme Pty Ltd');
    expect(formatted).toContain('Licensor');
  });

  it('scores readiness tone bands', () => {
    expect(readinessTone(82)).toBe('high');
    expect(readinessTone(55)).toBe('medium');
    expect(readinessTone(25)).toBe('low');
    expect(readinessLabel(82)).toBe('Strong readiness');
  });

  it('validates public report access tokens', () => {
    expect(isValidReportAccessToken('rpt_8f3h2k1m9x')).toBe(true);
    expect(isValidReportAccessToken('not-a-token')).toBe(false);
  });
});
