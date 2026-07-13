/**
 * Cost forecast — participant payouts, supplier invoices, and future obligations.
 */

import type {
  CommercialForecastingInput,
  CostForecast,
  CostPeriodSlice,
} from '@/lib/commercial-forecasting/types';
import { CommercialForecastConfidence } from '@/lib/commercial-forecasting/types';
import { resolveCommercialTiming } from '@/lib/commercial-timing/resolve-commercial-timing';
import type { YearMonth } from '@/lib/commercial-timing/types';

function toAmount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function periodFromSettlementTiming(
  input: CommercialForecastingInput
): YearMonth | null {
  const timing = resolveCommercialTiming({
    agreementDefaults: input.agreementTiming ?? null,
    documentTiming: null,
  });

  const dateStr = timing.expectedSettlementDate;
  if (!dateStr) return null;

  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function obligationConfidence(status: string): CommercialForecastConfidence {
  if (status === 'FUNDED' || status === 'READY' || status === 'SETTLED') {
    return CommercialForecastConfidence.Likely;
  }
  if (status === 'APPROVED') {
    return CommercialForecastConfidence.Expected;
  }
  return CommercialForecastConfidence.Tentative;
}

/** Derive cost forecast from obligation rows and commercial timing. */
export function deriveCostForecast(input: CommercialForecastingInput): CostForecast {
  let participantPayouts = 0;
  let supplierInvoices = 0;
  let operationalCosts = 0;
  let futureObligations = 0;

  for (const row of input.obligationRows) {
    const amount = toAmount(row.amount_owed);
    const type = row.obligation_type.toLowerCase();

    if (type.includes('supplier') || type.includes('invoice')) {
      supplierInvoices += amount;
    } else if (type.includes('operational') || type.includes('expense')) {
      operationalCosts += amount;
    } else {
      participantPayouts += amount;
    }

    if (row.status !== 'SETTLED' && row.status !== 'PAID') {
      futureObligations += amount;
    }
  }

  const totalForecastCosts = participantPayouts + supplierInvoices + operationalCosts;
  const period = periodFromSettlementTiming(input);

  const byPeriod: CostPeriodSlice[] = period
    ? [
        {
          period,
          expectedAmount: totalForecastCosts,
          confidence:
            futureObligations === 0
              ? CommercialForecastConfidence.Committed
              : CommercialForecastConfidence.Expected,
        },
      ]
    : input.obligationRows.length > 0
      ? [
          {
            period: { year: new Date().getFullYear(), month: new Date().getMonth() + 1 },
            expectedAmount: totalForecastCosts,
            confidence: obligationConfidence(
              input.obligationRows[0]?.status ?? 'PENDING'
            ),
          },
        ]
      : [];

  return {
    participantPayouts,
    supplierInvoices,
    operationalCosts,
    futureObligations,
    totalForecastCosts,
    currency: input.currency,
    byPeriod,
  };
}
