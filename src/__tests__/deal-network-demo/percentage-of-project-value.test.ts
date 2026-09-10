import { resolveCommissionWithValidation } from '@/lib/deal-network-demo/commission-structure';

describe('percentage of project value', () => {
  it('does not fail when project value is missing; it marks earnings as incalculable', () => {
    const result = resolveCommissionWithValidation(
      { commissionKind: 'pct_deal_value', commissionValue: 10 },
      { dealValue: 0 }
    );
    expect(result.valid).toBe(true);
    expect(result.missingProjectValue).toBe(true);
    expect(result.total).toBe(0);
    expect(result.previewLine).toBe('10% of project value');
    expect(result.error).toBe('Project value is required to calculate earnings.');
  });

  it('calculates once a project value is added later', () => {
    const result = resolveCommissionWithValidation(
      { commissionKind: 'pct_deal_value', commissionValue: 10 },
      { dealValue: 100000 }
    );
    expect(result.valid).toBe(true);
    expect(result.missingProjectValue).toBeUndefined();
    expect(result.total).toBe(10000);
    expect(result.previewLine).toMatch(/10% of deal value/);
  });

  it('does not convert the commission to another type when value is missing', () => {
    const result = resolveCommissionWithValidation(
      { commissionKind: 'pct_deal_value', commissionValue: 2 },
      { dealValue: 0 }
    );
    expect(result.previewLine).toContain('% of project value');
    expect(result.previewLine).not.toMatch(/fixed/i);
  });
});
