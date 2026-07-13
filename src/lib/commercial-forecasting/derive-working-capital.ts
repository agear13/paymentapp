/**
 * Working capital forecast — receivables, payables, expected cash, settlement.
 */

import type {
  CommercialForecastingInput,
  WorkingCapitalForecast,
  CashflowForecast,
} from '@/lib/commercial-forecasting/types';
import { deriveCashflowForecast } from '@/lib/commercial-forecasting/derive-cashflow-forecast';
import type { CommercialForecastResult } from '@/lib/commercial/commercial-forecast';

/** Derive working capital from commercial commitments. */
export function deriveWorkingCapital(
  input: CommercialForecastingInput,
  cashflow?: CashflowForecast,
  dollarForecast?: CommercialForecastResult
): WorkingCapitalForecast {
  const cf = cashflow ?? deriveCashflowForecast(input);

  const accountsReceivable = cf.outstandingReceivables;

  const accountsPayable = cf.outstandingPayables;

  const outstandingSettlement = input.settlementForecasts
    ? input.settlementForecasts
        .filter((s) => !s.settlementReady)
        .reduce((sum, s) => sum + s.amount, 0)
    : input.obligationRows
        .filter((r) => r.status === 'FUNDED' || r.status === 'READY')
        .reduce((sum, r) => sum + (Number(r.amount_owed) || 0), 0);

  const futureCommitments = input.obligationRows
    .filter((r) => r.status !== 'SETTLED' && r.status !== 'PAID')
    .reduce((sum, r) => sum + (Number(r.amount_owed) || 0), 0);

  const expectedCash =
    dollarForecast?.cashReadiness.expectedBalanceAfterSettlement ??
    cf.expectedCashBalance;

  return {
    accountsReceivable,
    accountsPayable,
    expectedCash,
    outstandingSettlement,
    futureCommitments,
    currency: input.currency,
  };
}
