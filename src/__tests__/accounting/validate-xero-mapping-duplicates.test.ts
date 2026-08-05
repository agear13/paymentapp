import { validateXeroMappingDuplicates } from '@/lib/accounting/validate-xero-mapping-duplicates';

describe('validateXeroMappingDuplicates', () => {
  it('accepts duplicate legacy crypto codes under shared strategy', () => {
    const result = validateXeroMappingDuplicates({
      xero_revenue_account_id: '200',
      xero_receivable_account_id: '610',
      xero_stripe_clearing_account_id: '1050',
      xero_hbar_clearing_account_id: '1060',
      xero_usdc_clearing_account_id: '1060',
      xero_usdt_clearing_account_id: '1060',
      xero_audd_clearing_account_id: '1060',
    });

    expect(result.valid).toBe(true);
  });

  it('rejects duplicate legacy crypto codes under per-asset strategy', () => {
    const result = validateXeroMappingDuplicates({
      cryptoSettlementStrategy: 'per_asset',
      xero_revenue_account_id: '200',
      xero_receivable_account_id: '610',
      xero_hbar_clearing_account_id: '1051',
      xero_usdc_clearing_account_id: '1051',
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('different Xero account');
  });

  it('rejects duplicate revenue and receivable mappings', () => {
    const result = validateXeroMappingDuplicates({
      xero_revenue_account_id: '200',
      xero_receivable_account_id: '200',
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Revenue, receivable');
  });

  it('rejects shared crypto code matching stripe holding', () => {
    const result = validateXeroMappingDuplicates({
      xero_revenue_account_id: '200',
      xero_receivable_account_id: '610',
      xero_stripe_clearing_account_id: '1060',
      xero_hbar_clearing_account_id: '1060',
      xero_usdc_clearing_account_id: '1060',
      xero_usdt_clearing_account_id: '1060',
      xero_audd_clearing_account_id: '1060',
    });

    expect(result.valid).toBe(false);
  });
});
