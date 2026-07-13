/**
 * Commercial Forecasting Engine tests.
 *
 * Proves forecasting derives from commercial commitments — not accounting history.
 */

import {
  CommercialForecastConfidence,
  ForecastEventCategory,
  deriveCommercialForecasting,
  deriveForecastEvents,
  deriveRevenueForecast,
  deriveCostForecast,
  deriveCashflowForecast,
  deriveProfitForecast,
  deriveWorkingCapital,
  deriveRiskAnalysis,
  buildForecastTimeline,
  confidenceFromFundingSource,
  confidenceFromSettlement,
  derivePortfolioForecast,
  deriveAllForecastReports,
} from '@/lib/commercial-forecasting';
import { CustomerInvoiceLifecycleState } from '@/lib/payment-links/customer-invoice-lifecycle';
import { CommercialReconciliationStatus } from '@/lib/commercial-reconciliation/types';

const BASE_INPUT = {
  projectId: 'proj-001',
  dealId: 'deal-001',
  agreementId: 'deal-001',
  currency: 'AUD',
  asOfDate: '2026-07-01',
  agreementTiming: {
    servicePeriodStart: '2026-07-20T00:00:00.000Z',
    servicePeriodEnd: '2026-07-31T00:00:00.000Z',
    recognitionPeriod: { year: 2026, month: 7 },
    expectedPaymentDate: '2026-07-15T00:00:00.000Z',
    expectedSettlementDate: '2026-08-15T00:00:00.000Z',
  },
  fundingSources: [
    {
      id: 'fs-1',
      projectId: 'proj-001',
      organizationId: 'org-001',
      name: 'Viking Cruises',
      description: null,
      sourceType: 'REVENUE' as const,
      amount: 18000,
      currency: 'AUD',
      status: 'PENDING' as const,
      confidenceLevel: 'HIGH' as const,
      expectedSettlementDate: '2026-07-15',
      actualSettlementDate: null,
      linkedInvoiceId: null,
      linkedPaymentId: null,
      notes: null,
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    },
  ],
  treasury: null,
  obligationRows: [
    {
      id: 'obl-1',
      deal_id: 'deal-001',
      obligation_type: 'fixed_fee',
      status: 'FUNDED',
      amount_owed: 5000,
      currency: 'AUD',
      participant: { name: 'Sarah', role: 'Performer' },
    },
  ],
  releaseConfidence: null,
};

function makeInput(overrides: Partial<typeof BASE_INPUT> = {}) {
  return { ...BASE_INPUT, ...overrides };
}

describe('deriveCommercialForecasting', () => {
  it('derives future revenue from agreements and funding sources', () => {
    const forecast = deriveCommercialForecasting(makeInput());
    expect(forecast.revenue.totalForecastRevenue).toBe(18000);
    expect(forecast.revenue.pendingRevenue).toBe(18000);
    expect(forecast.dealId).toBe('deal-001');
  });

  it('does not require historical accounting entries', () => {
    const forecast = deriveCommercialForecasting(
      makeInput({ treasury: null, releaseConfidence: null })
    );
    expect(forecast.revenue.totalForecastRevenue).toBeGreaterThan(0);
    expect(forecast.events.length).toBeGreaterThan(0);
  });

  it('remains backwards compatible with empty inputs', () => {
    const forecast = deriveCommercialForecasting({
      currency: 'AUD',
      fundingSources: [],
      treasury: null,
      obligationRows: [],
      releaseConfidence: null,
    });
    expect(forecast.revenue.totalForecastRevenue).toBe(0);
    expect(forecast.costs.totalForecastCosts).toBe(0);
    expect(forecast.overallConfidence).toBe(CommercialForecastConfidence.Tentative);
  });
});

describe('forecast events', () => {
  it('forecasts commercial events — not just balances', () => {
    const events = deriveForecastEvents(makeInput());
    const paymentEvent = events.find(
      (e) => e.category === ForecastEventCategory.CustomerPaymentExpected
    );
    expect(paymentEvent).toBeDefined();
    expect(paymentEvent?.amount).toBe(18000);
    expect(paymentEvent?.date).toBe('2026-07-15');
  });

  it('includes service period and revenue recognition events from timing', () => {
    const events = deriveForecastEvents(makeInput());
    expect(
      events.some((e) => e.category === ForecastEventCategory.ServicePeriodStart)
    ).toBe(true);
    expect(
      events.some((e) => e.category === ForecastEventCategory.RevenueRecognised)
    ).toBe(true);
  });

  it('includes participant settlement events from obligations', () => {
    const events = deriveForecastEvents(makeInput());
    const settlement = events.find(
      (e) => e.category === ForecastEventCategory.ParticipantSettlement
    );
    expect(settlement).toBeDefined();
    expect(settlement?.amount).toBe(5000);
  });

  it('sorts events chronologically', () => {
    const events = deriveForecastEvents(makeInput());
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.date >= events[i - 1]!.date).toBe(true);
    }
  });
});

describe('revenue forecast', () => {
  it('classifies committed, pending, and expected revenue', () => {
    const confirmed = deriveRevenueForecast(
      makeInput({
        fundingSources: [
          {
            ...BASE_INPUT.fundingSources[0]!,
            id: 'fs-confirmed',
            status: 'CONFIRMED',
            amount: 10000,
          },
          {
            ...BASE_INPUT.fundingSources[0]!,
            id: 'fs-pending',
            status: 'PENDING',
            amount: 5000,
          },
          {
            ...BASE_INPUT.fundingSources[0]!,
            id: 'fs-forecast',
            status: 'FORECAST',
            amount: 3000,
            confidenceLevel: 'LOW',
          },
        ],
      })
    );
    expect(confirmed.committedRevenue).toBe(10000);
    expect(confirmed.pendingRevenue).toBe(5000);
    expect(confirmed.expectedRevenue).toBe(3000);
    expect(confirmed.totalForecastRevenue).toBe(18000);
  });
});

describe('cost forecast', () => {
  it('derives participant payouts from obligations', () => {
    const costs = deriveCostForecast(makeInput());
    expect(costs.participantPayouts).toBe(5000);
    expect(costs.totalForecastCosts).toBe(5000);
  });
});

describe('cashflow forecast', () => {
  it('derives cashflow from payment timing — not accounting history', () => {
    const cashflow = deriveCashflowForecast(makeInput());
    expect(cashflow.expectedCustomerPayments).toBeGreaterThan(0);
    expect(cashflow.outstandingReceivables).toBe(18000);
    expect(cashflow.outstandingPayables).toBe(5000);
  });

  it('tracks outstanding payables from unfunded obligations', () => {
    const cashflow = deriveCashflowForecast(
      makeInput({
        obligationRows: [
          {
            ...BASE_INPUT.obligationRows[0]!,
            status: 'PENDING',
          },
        ],
      })
    );
    expect(cashflow.outstandingPayables).toBe(5000);
  });
});

describe('settlement forecast', () => {
  it('derives expected settlement from settlement workflow inputs', () => {
    const forecast = deriveCommercialForecasting(
      makeInput({
        settlementForecasts: [
          {
            participantId: 'p-1',
            participantName: 'Sarah',
            amount: 5000,
            currency: 'AUD',
            expectedSettlementDate: '2026-08-15',
            settlementReady: false,
            agreementApproved: true,
          },
        ],
      })
    );
    const settlementEvents = forecast.events.filter(
      (e) => e.category === ForecastEventCategory.ParticipantSettlement
    );
    expect(settlementEvents.length).toBeGreaterThan(0);
    expect(forecast.workingCapital.outstandingSettlement).toBe(5000);
  });
});

describe('forecast confidence', () => {
  it('derives confidence from workflow state — not fabricated', () => {
    const { confidence, reasons } = confidenceFromFundingSource(
      BASE_INPUT.fundingSources[0]!
    );
    expect(confidence).toBe(CommercialForecastConfidence.Likely);
    expect(reasons.length).toBeGreaterThan(0);
  });

  it('reduces confidence for unapproved settlements', () => {
    const { confidence } = confidenceFromSettlement({
      participantId: 'p-1',
      participantName: 'Sarah',
      amount: 5000,
      currency: 'AUD',
      settlementReady: false,
      agreementApproved: false,
    });
    expect(confidence).toBe(CommercialForecastConfidence.Tentative);
  });

  it('derives overall confidence from weakest signal', () => {
    const forecast = deriveCommercialForecasting(makeInput());
    expect(forecast.overallConfidenceReasons.length).toBeGreaterThan(0);
  });
});

describe('profit and working capital', () => {
  it('derives profit from commercial data', () => {
    const profit = deriveProfitForecast(makeInput());
    expect(profit.netProfit).toBe(18000 - 5000);
    expect(profit.grossProfit).toBe(18000 - 5000);
  });

  it('derives working capital from receivables and payables', () => {
    const wc = deriveWorkingCapital(makeInput());
    expect(wc.accountsReceivable).toBe(18000);
    expect(wc.futureCommitments).toBe(5000);
  });
});

describe('forecast timeline', () => {
  it('builds reusable monthly timeline bars', () => {
    const timeline = buildForecastTimeline(makeInput());
    expect(timeline.length).toBeGreaterThan(0);
    const july = timeline.find((m) => m.period.month === 7);
    expect(july).toBeDefined();
    expect(july!.revenue).toBeGreaterThan(0);
    expect(july!.revenueBar).toBeGreaterThan(0);
    expect(july!.revenueBar).toBeLessThanOrEqual(1);
  });
});

describe('risk analysis', () => {
  it('detects late customer payment from commercial timing', () => {
    const risks = deriveRiskAnalysis(
      makeInput({
        asOfDate: '2026-08-01',
        fundingSources: [
          {
            ...BASE_INPUT.fundingSources[0]!,
            status: 'PENDING',
            expectedSettlementDate: '2026-07-15',
          },
        ],
      })
    );
    expect(risks.some((r) => r.category === 'late_customer_payment')).toBe(true);
  });

  it('detects revenue concentration', () => {
    const risks = deriveRiskAnalysis(makeInput());
    expect(risks.some((r) => r.category === 'revenue_concentration')).toBe(true);
  });
});

describe('invoice lifecycle integration', () => {
  it('includes invoice payment events with lifecycle confidence', () => {
    const events = deriveForecastEvents(
      makeInput({
        invoiceForecasts: [
          {
            paymentLinkId: 'inv-1',
            invoiceAmount: 18000,
            amountPaid: 0,
            linkStatus: 'OPEN',
            lifecycleState: CustomerInvoiceLifecycleState.OUTSTANDING,
            commercialTiming: {
              expectedPaymentDate: '2026-07-15T00:00:00.000Z',
              source: 'agreement',
              inheritedFields: [],
              overriddenFields: [],
              hasTiming: true,
            },
            reconciliationStatus: CommercialReconciliationStatus.Pending,
          },
        ],
      })
    );
    const invoicePayment = events.find(
      (e) => e.relatedId === 'inv-1' && e.category === ForecastEventCategory.CustomerPaymentExpected
    );
    expect(invoicePayment).toBeDefined();
    expect(invoicePayment?.confidence).toBe(CommercialForecastConfidence.Expected);
  });
});

describe('reporting extension points', () => {
  it('derives all forecast reports without UI', () => {
    const reports = deriveAllForecastReports(makeInput());
    expect(reports).toHaveLength(5);
    expect(reports.map((r) => r.title)).toContain('Revenue Forecast');
    expect(reports.map((r) => r.title)).toContain('Cashflow Forecast');
  });
});

describe('partner workspace', () => {
  it('supports portfolio aggregation without redesign', () => {
    const portfolio = derivePortfolioForecast([
      makeInput(),
      makeInput({ projectId: 'proj-002', dealId: 'deal-002' }),
    ]);
    expect(portfolio.merchantCount).toBe(2);
    expect(portfolio.aggregatedRevenue).toBe(36000);
    expect(portfolio.upcomingEvents.length).toBeGreaterThan(0);
  });
});

describe('existing architecture preserved', () => {
  it('delegates dollar forecast to existing deriveCommercialForecast', () => {
    const forecast = deriveCommercialForecasting(makeInput());
    expect(forecast.dollarForecast.totalExpectedRevenue).toBe(18000);
    expect(forecast.dollarForecast.totalCommitments).toBe(5000);
    expect(forecast.dollarForecast.forecastPosition.forecastBalance).toBe(13000);
  });
});
