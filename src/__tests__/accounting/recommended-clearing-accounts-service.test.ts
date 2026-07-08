import {
  buildRecommendedMappings,
  detectClearingAccountMappings,
  findAccountByExactName,
  getMissingRecommendedClearingAccounts,
  mergeRecommendedMappingsIntoEmptyFields,
  resolveAvailableAccountCode,
  resolveStandardMapping,
} from '@/lib/accounting/recommended-clearing-accounts-service';
import { RECOMMENDED_STANDARD_MAPPINGS } from '@/lib/accounting/recommended-accounting-config';

describe('recommended-clearing-accounts-service', () => {
  const sampleAccounts = [
    { code: '200', name: 'Sales', type: 'REVENUE', status: 'ACTIVE' },
    { code: '610', name: 'Accounts Receivable', type: 'CURRENT', status: 'ACTIVE' },
    { code: '404', name: 'Bank Fees', type: 'EXPENSE', status: 'ACTIVE' },
    { code: '1050', name: 'Stripe Clearing', type: 'CURRENT', status: 'ACTIVE' },
    { code: '1051', name: 'HBAR Clearing', type: 'CURRENT', status: 'ACTIVE' },
    { code: '1052', name: 'USDC Clearing', type: 'CURRENT', status: 'ACTIVE' },
    { code: '1053', name: 'USDT Clearing', type: 'CURRENT', status: 'ACTIVE' },
    { code: '1054', name: 'AUDD Clearing', type: 'CURRENT', status: 'ACTIVE' },
  ];

  it('detects clearing accounts by exact name', () => {
    expect(detectClearingAccountMappings(sampleAccounts)).toEqual({
      xero_stripe_clearing_account_id: '1050',
      xero_hbar_clearing_account_id: '1051',
      xero_usdc_clearing_account_id: '1052',
      xero_usdt_clearing_account_id: '1053',
      xero_audd_clearing_account_id: '1054',
    });
  });

  it('lists missing recommended clearing accounts', () => {
    const missing = getMissingRecommendedClearingAccounts([
      { code: '1050', name: 'Stripe Clearing', type: 'CURRENT', status: 'ACTIVE' },
    ]);

    expect(missing.map((item) => item.accountName)).toEqual([
      'HBAR Clearing',
      'USDC Clearing',
      'USDT Clearing',
      'AUDD Clearing',
    ]);
  });

  it('builds recommended mappings without overwriting existing values', () => {
    const recommended = buildRecommendedMappings(sampleAccounts, {
      xero_revenue_account_id: '999',
    });

    expect(recommended).toEqual({
      xero_receivable_account_id: '610',
      xero_stripe_clearing_account_id: '1050',
      xero_hbar_clearing_account_id: '1051',
      xero_usdc_clearing_account_id: '1052',
      xero_usdt_clearing_account_id: '1053',
      xero_audd_clearing_account_id: '1054',
      xero_fee_expense_account_id: '404',
    });
    expect(recommended.xero_revenue_account_id).toBeUndefined();
  });

  it('merges recommended mappings only into empty fields', () => {
    const merged = mergeRecommendedMappingsIntoEmptyFields(
      { xero_revenue_account_id: '999' },
      {
        xero_revenue_account_id: '200',
        xero_stripe_clearing_account_id: '1050',
      }
    );

    expect(merged).toEqual({
      xero_revenue_account_id: '999',
      xero_stripe_clearing_account_id: '1050',
    });
  });

  it('resolves standard mappings by preferred code then name', () => {
    const revenueRule = RECOMMENDED_STANDARD_MAPPINGS.find(
      (item) => item.mappingField === 'xero_revenue_account_id'
    )!;

    expect(resolveStandardMapping(sampleAccounts, revenueRule)).toBe('200');
    expect(
      resolveStandardMapping(
        [{ code: '401', name: 'Sales', type: 'REVENUE', status: 'ACTIVE' }],
        revenueRule
      )
    ).toBe('401');
  });

  it('finds accounts by exact name only', () => {
    expect(findAccountByExactName(sampleAccounts, 'Stripe Clearing')?.code).toBe('1050');
    expect(findAccountByExactName(sampleAccounts, 'Stripe')).toBeUndefined();
  });

  it('picks the next available account code when the preferred code is taken', () => {
    expect(
      resolveAvailableAccountCode(
        [{ code: '1050', name: 'Other', type: 'CURRENT', status: 'ACTIVE' }],
        '1050'
      )
    ).toBe('1051');
  });
});
