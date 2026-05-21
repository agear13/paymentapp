import {
  buildHederaSettlementInsight,
  buildPayoutReadinessInsight,
  buildStripeClearingDiscrepancyInsight,
  buildUnfundedObligationsInsight,
  getOperationalInsightsFromSnapshot,
} from '@/lib/reports/operational-insights';
import type { ReconciliationReportData } from '@/lib/reports/reconciliation-types';

function emptyReconciliation(
  overrides?: Partial<ReconciliationReportData['report']['stripe']>
): ReconciliationReportData {
  const zero = {
    expectedRevenue: 0,
    ledgerBalance: 0,
    difference: 0,
    paymentCount: 0,
  };
  return {
    report: {
      stripe: { ...zero, ...overrides },
      wise: { ...zero },
      hedera_hbar: { ...zero },
      hedera_usdc: { ...zero },
      hedera_usdt: { ...zero },
      hedera_audd: { ...zero },
    },
    isReconciled: true,
    totalDifference: 0,
    timestamp: new Date().toISOString(),
  };
}

describe('operational insights', () => {
  it('surfaces stripe clearing discrepancy when difference is non-zero', () => {
    const insight = buildStripeClearingDiscrepancyInsight(0.33, 'AUD');
    expect(insight).toMatchObject({
      id: 'stripe-clearing-discrepancy',
      severity: 'error',
    });
    expect(insight?.message).toContain('A$0.33');
  });

  it('omits stripe insight when clearing is balanced', () => {
    expect(buildStripeClearingDiscrepancyInsight(0, 'AUD')).toBeNull();
  });

  it('surfaces unfunded obligations when count is positive', () => {
    const insight = buildUnfundedObligationsInsight(1);
    expect(insight?.message).toBe('1 unfunded obligation requires attention');
  });

  it('always includes payout readiness with count', () => {
    expect(buildPayoutReadinessInsight(0).message).toBe('0 payouts ready for release');
    expect(buildPayoutReadinessInsight(2).message).toBe('2 payouts ready for release');
  });

  it('includes hedera balanced insight when all hedera rails reconcile', () => {
    const insight = buildHederaSettlementInsight(emptyReconciliation());
    expect(insight?.message).toBe('Digital settlement rails balanced');
  });

  it('aggregates insights in stable order', () => {
    const insights = getOperationalInsightsFromSnapshot({
      reconciliation: emptyReconciliation({ difference: 0.33 }),
      unfundedObligationCount: 1,
      readyPayoutCount: 0,
      currencyCode: 'AUD',
    });

    expect(insights.map((i) => i.id)).toEqual([
      'stripe-clearing-discrepancy',
      'unfunded-obligations',
      'payout-readiness',
      'hedera-settlement-balanced',
    ]);
  });
});
