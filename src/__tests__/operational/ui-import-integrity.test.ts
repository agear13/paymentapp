import { execSync } from 'child_process';
import path from 'path';

import {
  formatCurrency,
  formatCompactCurrency,
} from '@/lib/formatters/format-currency';
import { operationalStatusLabel } from '@/lib/payments/operational-status-labels';
import { getPaymentLinkUrl } from '@/lib/branding/customer-facing-url';
import { cn } from '@/lib/utils';

describe('operational UI module bindings', () => {
  it('exports critical utilities used by invoice/payment flows', () => {
    expect(typeof formatCurrency).toBe('function');
    expect(typeof formatCompactCurrency).toBe('function');
    expect(typeof operationalStatusLabel).toBe('function');
    expect(typeof getPaymentLinkUrl).toBe('function');
    expect(typeof cn).toBe('function');
  });

  it('formatCurrency does not throw for invoice table values', () => {
    expect(() => formatCurrency(Number('10.50'), 'USD')).not.toThrow();
    expect(formatCurrency(Number('10.50'), 'USD')).toMatch(/10\.50/);
  });
});

describe('UI import verification script', () => {
  it('passes static JSX/util import scan', () => {
    const script = path.join(process.cwd(), 'scripts', 'verify-ui-imports.mjs');
    expect(() => {
      execSync(`node "${script}"`, {
        cwd: process.cwd(),
        stdio: 'pipe',
        encoding: 'utf8',
      });
    }).not.toThrow();
  });
});
