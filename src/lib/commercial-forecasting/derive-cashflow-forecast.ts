/**
 * Cashflow forecast — expected payments, settlements, and cash balance.
 *
 * Does not rely on historical accounting entries. Uses commercial commitments
 * and forecast events for time-bucketed cashflow.
 */

import type {
  CashflowForecast,
  CashflowPeriodSlice,
  CommercialForecastingInput,
  ForecastEvent,
} from '@/lib/commercial-forecasting/types';
import {
  ForecastEventCategory,
} from '@/lib/commercial-forecasting/types';
import { deriveForecastEvents } from '@/lib/commercial-forecasting/derive-forecast-events';
import { isFundingConfirmed } from '@/lib/projects/funding-sources/funding-source-status';
import type { YearMonth } from '@/lib/commercial-timing/types';

function periodFromDate(date: string): YearMonth {
  const d = new Date(date);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function periodKey(p: YearMonth): string {
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
}

function monthLabel(p: YearMonth): string {
  const d = new Date(p.year, p.month - 1, 1);
  return d.toLocaleString('en-AU', { month: 'long', year: 'numeric' });
}

const INFLOW_CATEGORIES = new Set<ForecastEventCategory>([
  ForecastEventCategory.CustomerPaymentExpected,
  ForecastEventCategory.BankPayoutClearing,
]);

const OUTFLOW_CATEGORIES = new Set<ForecastEventCategory>([
  ForecastEventCategory.ParticipantSettlement,
  ForecastEventCategory.ObligationDue,
  ForecastEventCategory.TaxLiabilityDue,
]);

function buildPeriodSlices(
  events: ForecastEvent[],
  openingBalance: number
): CashflowPeriodSlice[] {
  const periodMap = new Map<string, { period: YearMonth; inflows: number; outflows: number }>();

  for (const event of events) {
    if (event.occurred) continue;
    if (event.amount === null || event.amount <= 0) continue;

    const period = periodFromDate(event.date);
    const key = periodKey(period);
    const existing = periodMap.get(key) ?? { period, inflows: 0, outflows: 0 };

    if (INFLOW_CATEGORIES.has(event.category)) {
      existing.inflows += event.amount;
    } else if (OUTFLOW_CATEGORIES.has(event.category)) {
      existing.outflows += event.amount;
    }

    periodMap.set(key, existing);
  }

  const sorted = [...periodMap.values()].sort((a, b) =>
    periodKey(a.period).localeCompare(periodKey(b.period))
  );

  let balance = openingBalance;
  return sorted.map((p) => {
    const netCashflow = p.inflows - p.outflows;
    const opening = balance;
    balance += netCashflow;
    return {
      period: p.period,
      inflows: p.inflows,
      outflows: p.outflows,
      netCashflow,
      openingBalance: opening,
      closingBalance: balance,
    };
  });
}

/** Derive cashflow forecast from commercial commitments and events. */
export function deriveCashflowForecast(
  input: CommercialForecastingInput,
  events?: ForecastEvent[]
): CashflowForecast {
  const forecastEvents = events ?? deriveForecastEvents(input);
  const openingBalance = input.openingCashBalance ?? 0;

  let expectedCustomerPayments = 0;
  let expectedParticipantSettlements = 0;
  let expectedBankDeposits = 0;

  for (const event of forecastEvents) {
    if (event.occurred || event.amount === null) continue;

    if (event.category === ForecastEventCategory.CustomerPaymentExpected) {
      expectedCustomerPayments += event.amount;
    }
    if (event.category === ForecastEventCategory.ParticipantSettlement) {
      expectedParticipantSettlements += event.amount;
    }
    if (event.category === ForecastEventCategory.BankPayoutClearing) {
      expectedBankDeposits += event.amount;
    }
  }

  const outstandingReceivables = input.fundingSources
    .filter((s) => !isFundingConfirmed(s.status))
    .reduce((sum, s) => sum + s.amount, 0);

  const outstandingPayables = input.obligationRows
    .filter((r) => r.status !== 'SETTLED' && r.status !== 'PAID')
    .reduce((sum, r) => sum + (Number(r.amount_owed) || 0), 0);

  const periods = buildPeriodSlices(forecastEvents, openingBalance);
  const expectedCashBalance =
    openingBalance + expectedCustomerPayments - expectedParticipantSettlements;

  return {
    expectedCustomerPayments,
    expectedParticipantSettlements,
    expectedBankDeposits,
    expectedCashBalance,
    outstandingReceivables,
    outstandingPayables,
    currency: input.currency,
    periods,
  };
}

/** Format period label for cashflow display. */
export { monthLabel as formatCashflowPeriodLabel };
