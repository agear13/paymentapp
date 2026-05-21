import {
  countReconciliationDiscrepancies,
  getReconciliationHeadline,
  getReconciliationHeroHeadline,
} from '@/lib/reports/reconciliation-display';
import type { ReconciliationReportData } from '@/lib/reports/reconciliation-types';

function emptyReport(): ReconciliationReportData['report'] {
  const zero = {
    expectedRevenue: 0,
    ledgerBalance: 0,
    difference: 0,
    paymentCount: 0,
  };
  return {
    stripe: { ...zero },
    wise: { ...zero },
    hedera_hbar: { ...zero },
    hedera_usdc: { ...zero },
    hedera_usdt: { ...zero },
    hedera_audd: { ...zero },
  };
}

describe('reconciliation display', () => {
  it('reports all reconciled when balanced', () => {
    const data: ReconciliationReportData = {
      report: emptyReport(),
      isReconciled: true,
      totalDifference: 0,
      timestamp: new Date().toISOString(),
    };
    expect(getReconciliationHeadline(data)).toBe('All accounts reconciled');
    expect(getReconciliationHeroHeadline('reconciled', 0)).toBe(
      'All payment rails reconciled'
    );
    expect(countReconciliationDiscrepancies(data.report)).toBe(0);
  });

  it('includes wise in discrepancy headline', () => {
    const report = emptyReport();
    report.wise.difference = 0.5;
    const data: ReconciliationReportData = {
      report,
      isReconciled: false,
      totalDifference: 0.5,
      timestamp: new Date().toISOString(),
    };
    expect(getReconciliationHeadline(data)).toContain('Wise');
  });
});
