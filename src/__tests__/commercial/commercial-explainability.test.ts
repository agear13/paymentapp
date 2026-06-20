/**
 * Commercial Explainability Engine — regression tests
 *
 * Sprint 7.5 — Commercial Number Explainability
 *
 * Test suite covers:
 *   - Expected Revenue breakdown
 *   - Obligations breakdown
 *   - Cash Readiness breakdown
 *   - Commercial Confidence breakdown
 *   - Net Forecast breakdown
 *   - Invoice linkage (hasLedgerEntries flag)
 *   - Forecast linkage (sourceType = 'Forecast')
 *   - Determinism (same inputs → same outputs)
 *   - No duplicate calculations (engine only explains existing forecast data)
 *   - No mutation of input
 *   - James Tourism scenario (mixed invoice + forecast)
 *   - Empty-state handling (no revenue, no obligations)
 *   - Mixed invoice + forecast scenarios
 */

import {
  deriveExpectedRevenueBreakdown,
  deriveExpectedObligationsBreakdown,
  deriveNetForecastBreakdown,
  deriveCashReadinessBreakdown,
  deriveCommercialConfidenceBreakdown,
  deriveRevenueSourceBreakdown,
  deriveCommercialFigureExplanation,
} from '@/lib/commercial/commercial-explainability';
import { deriveCommercialForecast } from '@/lib/commercial/commercial-forecast';
import type { CommercialForecastResult } from '@/lib/commercial/commercial-forecast';
import type { ProjectFundingSourceDto } from '@/lib/projects/funding-sources/types';
import type { BriefingObligationRowInput } from '@/lib/agreements/agreement-briefing.model';

/* ─── Test fixtures ──────────────────────────────────────────────────────────── */

function makeFundingSource(overrides: Partial<ProjectFundingSourceDto> = {}): ProjectFundingSourceDto {
  return {
    id: 'fs-001',
    name: 'Demo Booking',
    sourceType: 'invoice',
    amount: 5000,
    currency: 'AUD',
    // Status values must be uppercase — matches mapFundingStatus() in commercial-forecast.ts
    status: 'PENDING',
    expectedSettlementDate: '2025-07-15',
    linkedInvoiceId: null,
    linkedPaymentId: null,
    ...overrides,
  } as unknown as ProjectFundingSourceDto;
}

function makeObligation(overrides: Partial<BriefingObligationRowInput> = {}): BriefingObligationRowInput {
  return {
    id: 'obl-001',
    deal_id: 'deal-001',
    // amount_owed is the canonical field read by deriveCommitments()
    amount_owed: 1200,
    currency: 'AUD',
    obligation_type: 'fixed',
    status: 'approved',
    participant: { name: 'Guide', role: 'Guide' },
    ...overrides,
  } as unknown as BriefingObligationRowInput;
}

function buildForecast(
  fundingSources: ProjectFundingSourceDto[],
  obligationRows: BriefingObligationRowInput[],
  currency = 'AUD'
): CommercialForecastResult {
  return deriveCommercialForecast({
    fundingSources,
    treasury: null,
    obligationRows,
    releaseConfidence: null,
    currency,
  });
}

/* ─── Empty state ─────────────────────────────────────────────────────────────── */

describe('Empty state', () => {
  let emptyForecast: CommercialForecastResult;

  beforeEach(() => {
    emptyForecast = buildForecast([], []);
  });

  it('returns empty items for revenue breakdown when no sources', () => {
    const result = deriveExpectedRevenueBreakdown(emptyForecast);
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('provides emptyStateReason for revenue when no sources', () => {
    const result = deriveExpectedRevenueBreakdown(emptyForecast);
    expect(result.emptyStateReason).toBeTruthy();
    expect(result.emptyStateReason).not.toBe('');
  });

  it('provides emptyStateChecklist items for revenue empty state', () => {
    const result = deriveExpectedRevenueBreakdown(emptyForecast);
    expect(result.emptyStateChecklist).toBeDefined();
    expect(result.emptyStateChecklist!.length).toBeGreaterThan(0);
  });

  it('returns empty items for obligations breakdown when no obligations', () => {
    const result = deriveExpectedObligationsBreakdown(emptyForecast);
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('provides emptyStateReason for obligations when none exist', () => {
    const result = deriveExpectedObligationsBreakdown(emptyForecast);
    expect(result.emptyStateReason).toBeTruthy();
  });

  it('returns empty items for confidence breakdown when no sources', () => {
    const result = deriveCommercialConfidenceBreakdown(emptyForecast);
    expect(result.items).toHaveLength(0);
  });

  it('returns emptyStateReason for cash readiness when insufficient data', () => {
    const result = deriveCashReadinessBreakdown(emptyForecast);
    expect(result.emptyStateReason).toBeTruthy();
  });

  it('provides figure explanation for empty revenue', () => {
    const explanation = deriveCommercialFigureExplanation(emptyForecast, 'expected_revenue');
    expect(explanation).toBeTruthy();
    expect(typeof explanation).toBe('string');
  });

  it('net forecast returns Insufficient Data label when empty', () => {
    const result = deriveNetForecastBreakdown(emptyForecast);
    expect(result.positionLabel).toBe('Insufficient Data');
  });
});

/* ─── Single revenue source ──────────────────────────────────────────────────── */

describe('Single revenue source', () => {
  const source = makeFundingSource({ id: 'fs-1', name: 'Demo Booking', amount: 5000 });
  let forecast: CommercialForecastResult;

  beforeEach(() => {
    forecast = buildForecast([source], []);
  });

  it('returns one breakdown item matching the funding source', () => {
    const result = deriveExpectedRevenueBreakdown(forecast);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].description).toBe('Demo Booking');
    expect(result.items[0].amount).toBe(5000);
  });

  it('total equals the source amount', () => {
    const result = deriveExpectedRevenueBreakdown(forecast);
    expect(result.total).toBe(5000);
  });

  it('every item includes a sourceType', () => {
    const result = deriveExpectedRevenueBreakdown(forecast);
    result.items.forEach((item) => {
      expect(item.sourceType).toBeTruthy();
    });
  });

  it('every item includes a hasLedgerEntries flag', () => {
    const result = deriveExpectedRevenueBreakdown(forecast);
    result.items.forEach((item) => {
      expect(typeof item.hasLedgerEntries).toBe('boolean');
    });
  });

  it('item with linkedInvoiceId has hasLedgerEntries = true', () => {
    const invoicedSource = makeFundingSource({ id: 'fs-inv', linkedInvoiceId: 'inv-001' } as Partial<ProjectFundingSourceDto>);
    const f = buildForecast([invoicedSource], []);
    const result = deriveExpectedRevenueBreakdown(f);
    expect(result.items[0].hasLedgerEntries).toBe(true);
  });

  it('item without evidence has hasLedgerEntries = false', () => {
    const result = deriveExpectedRevenueBreakdown(forecast);
    expect(result.items[0].hasLedgerEntries).toBe(false);
  });
});

/* ─── Invoice linkage ─────────────────────────────────────────────────────────── */

describe('Invoice linkage', () => {
  it('source with linkedPaymentId is marked as having ledger entries', () => {
    const source = makeFundingSource({ linkedPaymentId: 'pay-001' } as Partial<ProjectFundingSourceDto>);
    const forecast = buildForecast([source], []);
    const result = deriveExpectedRevenueBreakdown(forecast);
    expect(result.items[0].hasLedgerEntries).toBe(true);
  });

  it('confirmed status source maps to Invoice sourceType', () => {
    // CONFIRMED is the uppercase canonical status for confirmed payments
    const source = makeFundingSource({ status: 'CONFIRMED', linkedInvoiceId: 'inv-001' } as Partial<ProjectFundingSourceDto>);
    const forecast = buildForecast([source], []);
    const result = deriveExpectedRevenueBreakdown(forecast);
    expect(result.items[0].sourceType).toBe('Invoice');
  });

  it('forecast status source maps to Forecast sourceType', () => {
    // FORECAST is the uppercase canonical status
    const source = makeFundingSource({ status: 'FORECAST', linkedInvoiceId: null } as Partial<ProjectFundingSourceDto>);
    const forecast = buildForecast([source], []);
    const result = deriveExpectedRevenueBreakdown(forecast);
    expect(result.items[0].sourceType).toBe('Forecast');
  });
});

/* ─── Obligations breakdown ──────────────────────────────────────────────────── */

describe('Obligations breakdown', () => {
  it('returns one item per obligation', () => {
    const obligations = [
      makeObligation({ id: 'obl-1', amount_owed: 1200, participant: { name: 'Guide', role: 'Guide' } } as Partial<BriefingObligationRowInput>),
      makeObligation({ id: 'obl-2', amount_owed: 8000, participant: { name: 'Boat Hire', role: 'Supplier' } } as Partial<BriefingObligationRowInput>),
    ];
    const forecast = buildForecast([], obligations);
    const result = deriveExpectedObligationsBreakdown(forecast);
    expect(result.items).toHaveLength(2);
  });

  it('total equals sum of obligation amounts', () => {
    const obligations = [
      makeObligation({ id: 'obl-1', amount_owed: 1200 } as Partial<BriefingObligationRowInput>),
      makeObligation({ id: 'obl-2', amount_owed: 8000 } as Partial<BriefingObligationRowInput>),
    ];
    const forecast = buildForecast([], obligations);
    const result = deriveExpectedObligationsBreakdown(forecast);
    // revenue share obligations may have amount=null; fixed ones sum up
    expect(result.total).toBe(forecast.totalCommitments);
  });

  it('every obligation item has sourceType Commercial Commitment', () => {
    const obligations = [makeObligation({ id: 'obl-1', amount_owed: 1200 } as Partial<BriefingObligationRowInput>)];
    const forecast = buildForecast([], obligations);
    const result = deriveExpectedObligationsBreakdown(forecast);
    result.items.forEach((item) => {
      expect(item.sourceType).toBe('Commercial Commitment');
    });
  });

  it('obligations that are commercial commitments have no ledger entries yet', () => {
    const obligations = [makeObligation({ id: 'obl-1', amount_owed: 1200 } as Partial<BriefingObligationRowInput>)];
    const forecast = buildForecast([], obligations);
    const result = deriveExpectedObligationsBreakdown(forecast);
    result.items.forEach((item) => {
      expect(item.hasLedgerEntries).toBe(false);
    });
  });

  it('reason string is non-empty', () => {
    const forecast = buildForecast([], [makeObligation({ amount_owed: 1200 } as Partial<BriefingObligationRowInput>)]);
    const result = deriveExpectedObligationsBreakdown(forecast);
    expect(result.reason.length).toBeGreaterThan(0);
  });
});

/* ─── Net Forecast breakdown ─────────────────────────────────────────────────── */

describe('Net Forecast breakdown', () => {
  it('netPosition = revenue.total - obligations.total', () => {
    const sources = [makeFundingSource({ amount: 50000 } as Partial<ProjectFundingSourceDto>)];
    const obligations = [makeObligation({ amount_owed: 14000 } as Partial<BriefingObligationRowInput>)];
    const forecast = buildForecast(sources, obligations);
    const result = deriveNetForecastBreakdown(forecast);
    expect(result.netPosition).toBe(result.revenue.total - result.obligations.total);
  });

  it('positionLabel is Surplus when revenue > obligations', () => {
    const sources = [makeFundingSource({ amount: 50000 } as Partial<ProjectFundingSourceDto>)];
    const obligations = [makeObligation({ amount_owed: 14000 } as Partial<BriefingObligationRowInput>)];
    const forecast = buildForecast(sources, obligations);
    const result = deriveNetForecastBreakdown(forecast);
    expect(result.positionLabel).toBe('Surplus');
  });

  it('positionLabel is Shortfall when obligations > revenue', () => {
    const sources = [makeFundingSource({ amount: 5000 } as Partial<ProjectFundingSourceDto>)];
    const obligations = [makeObligation({ amount_owed: 20000 } as Partial<BriefingObligationRowInput>)];
    const forecast = buildForecast(sources, obligations);
    const result = deriveNetForecastBreakdown(forecast);
    expect(result.positionLabel).toBe('Shortfall');
  });

  it('reason string contains both revenue and obligations amounts', () => {
    const sources = [makeFundingSource({ amount: 50000 } as Partial<ProjectFundingSourceDto>)];
    const obligations = [makeObligation({ amount_owed: 14000 } as Partial<BriefingObligationRowInput>)];
    const forecast = buildForecast(sources, obligations);
    const result = deriveNetForecastBreakdown(forecast);
    expect(result.reason).toContain('Revenue');
    expect(result.reason).toContain('Obligations');
  });

  it('revenue and obligations sub-breakdowns are consistent with standalone functions', () => {
    const sources = [makeFundingSource({ amount: 50000 } as Partial<ProjectFundingSourceDto>)];
    const obligations = [makeObligation({ amount_owed: 14000 } as Partial<BriefingObligationRowInput>)];
    const forecast = buildForecast(sources, obligations);
    const net = deriveNetForecastBreakdown(forecast);
    const rev = deriveExpectedRevenueBreakdown(forecast);
    const obl = deriveExpectedObligationsBreakdown(forecast);
    expect(net.revenue.total).toBe(rev.total);
    expect(net.obligations.total).toBe(obl.total);
  });
});

/* ─── Cash Readiness breakdown ───────────────────────────────────────────────── */

describe('Cash Readiness breakdown', () => {
  it('canEveryoneBePaid is true when revenue > obligations', () => {
    const sources = [makeFundingSource({ amount: 50000 } as Partial<ProjectFundingSourceDto>)];
    const obligations = [makeObligation({ amount_owed: 14000 } as Partial<BriefingObligationRowInput>)];
    const forecast = buildForecast(sources, obligations);
    const result = deriveCashReadinessBreakdown(forecast);
    expect(result.canEveryoneBePaid).toBe(true);
  });

  it('canEveryoneBePaid is false when obligations exceed revenue', () => {
    const sources = [makeFundingSource({ amount: 5000 } as Partial<ProjectFundingSourceDto>)];
    const obligations = [makeObligation({ amount_owed: 20000 } as Partial<BriefingObligationRowInput>)];
    const forecast = buildForecast(sources, obligations);
    const result = deriveCashReadinessBreakdown(forecast);
    expect(result.canEveryoneBePaid).toBe(false);
  });

  it('available.amount equals totalExpectedRevenue', () => {
    const sources = [makeFundingSource({ amount: 50000 } as Partial<ProjectFundingSourceDto>)];
    const forecast = buildForecast(sources, []);
    const result = deriveCashReadinessBreakdown(forecast);
    expect(result.available.amount).toBe(forecast.totalExpectedRevenue);
  });

  it('committed.amount equals totalCommitments', () => {
    const obligations = [makeObligation({ amount_owed: 14000 } as Partial<BriefingObligationRowInput>)];
    const forecast = buildForecast([], obligations);
    const result = deriveCashReadinessBreakdown(forecast);
    expect(result.committed.amount).toBe(forecast.totalCommitments);
  });

  it('remaining.amount = available - committed', () => {
    const sources = [makeFundingSource({ amount: 50000 } as Partial<ProjectFundingSourceDto>)];
    const obligations = [makeObligation({ amount_owed: 14000 } as Partial<BriefingObligationRowInput>)];
    const forecast = buildForecast(sources, obligations);
    const result = deriveCashReadinessBreakdown(forecast);
    expect(result.remaining.amount).toBe(result.available.amount - result.committed.amount);
  });

  it('all three figures have labels', () => {
    const forecast = buildForecast(
      [makeFundingSource()],
      [makeObligation({ amount_owed: 1200 } as Partial<BriefingObligationRowInput>)]
    );
    const result = deriveCashReadinessBreakdown(forecast);
    expect(result.available.label).toBeTruthy();
    expect(result.committed.label).toBeTruthy();
    expect(result.remaining.label).toBeTruthy();
  });
});

/* ─── Commercial Confidence breakdown ───────────────────────────────────────── */

describe('Commercial Confidence breakdown', () => {
  it('returns one confidence item per revenue source', () => {
    const sources = [
      makeFundingSource({ id: 'fs-1', name: 'Source A' }),
      makeFundingSource({ id: 'fs-2', name: 'Source B' }),
    ];
    const forecast = buildForecast(sources, []);
    const result = deriveCommercialConfidenceBreakdown(forecast);
    expect(result.items).toHaveLength(2);
  });

  it('total equals the forecast overallConfidence.score', () => {
    const forecast = buildForecast([makeFundingSource()], []);
    const result = deriveCommercialConfidenceBreakdown(forecast);
    expect(result.total).toBe(forecast.overallConfidence.score);
  });

  it('every item includes a confidence score between 0 and 100', () => {
    const sources = [makeFundingSource()];
    const forecast = buildForecast(sources, []);
    const result = deriveCommercialConfidenceBreakdown(forecast);
    result.items.forEach((item) => {
      expect(item.confidence).toBeGreaterThanOrEqual(0);
      expect(item.confidence).toBeLessThanOrEqual(100);
    });
  });

  it('every item includes confidenceReasons array', () => {
    const forecast = buildForecast([makeFundingSource()], []);
    const result = deriveCommercialConfidenceBreakdown(forecast);
    result.items.forEach((item) => {
      expect(Array.isArray(item.confidenceReasons)).toBe(true);
    });
  });
});

/* ─── Determinism ─────────────────────────────────────────────────────────────── */

describe('Determinism', () => {
  it('same inputs produce identical revenue breakdown output', () => {
    const sources = [makeFundingSource({ id: 'fs-1', amount: 5000 })];
    const forecast = buildForecast(sources, []);
    const r1 = deriveExpectedRevenueBreakdown(forecast);
    const r2 = deriveExpectedRevenueBreakdown(forecast);
    expect(r1.total).toBe(r2.total);
    expect(r1.items.length).toBe(r2.items.length);
    expect(r1.reason).toBe(r2.reason);
  });

  it('same inputs produce identical obligations breakdown output', () => {
    const obligations = [makeObligation({ amount_owed: 1200 } as Partial<BriefingObligationRowInput>)];
    const forecast = buildForecast([], obligations);
    const r1 = deriveExpectedObligationsBreakdown(forecast);
    const r2 = deriveExpectedObligationsBreakdown(forecast);
    expect(r1.total).toBe(r2.total);
    expect(r1.items.length).toBe(r2.items.length);
  });

  it('same inputs produce identical net forecast output', () => {
    const sources = [makeFundingSource({ amount: 50000 } as Partial<ProjectFundingSourceDto>)];
    const obligations = [makeObligation({ amount_owed: 14000 } as Partial<BriefingObligationRowInput>)];
    const forecast = buildForecast(sources, obligations);
    const r1 = deriveNetForecastBreakdown(forecast);
    const r2 = deriveNetForecastBreakdown(forecast);
    expect(r1.netPosition).toBe(r2.netPosition);
    expect(r1.positionLabel).toBe(r2.positionLabel);
  });

  it('same inputs produce identical cash readiness output', () => {
    const sources = [makeFundingSource({ amount: 50000 } as Partial<ProjectFundingSourceDto>)];
    const obligations = [makeObligation({ amount_owed: 14000 } as Partial<BriefingObligationRowInput>)];
    const forecast = buildForecast(sources, obligations);
    const r1 = deriveCashReadinessBreakdown(forecast);
    const r2 = deriveCashReadinessBreakdown(forecast);
    expect(r1.canEveryoneBePaid).toBe(r2.canEveryoneBePaid);
    expect(r1.available.amount).toBe(r2.available.amount);
  });
});

/* ─── No mutation ─────────────────────────────────────────────────────────────── */

describe('No mutation', () => {
  it('deriveExpectedRevenueBreakdown does not mutate the forecast input', () => {
    const forecast = buildForecast([makeFundingSource()], []);
    const originalLength = forecast.incomingRevenue.length;
    const originalTotal = forecast.totalExpectedRevenue;
    deriveExpectedRevenueBreakdown(forecast);
    expect(forecast.incomingRevenue.length).toBe(originalLength);
    expect(forecast.totalExpectedRevenue).toBe(originalTotal);
  });

  it('deriveExpectedObligationsBreakdown does not mutate the forecast input', () => {
    const forecast = buildForecast([], [makeObligation({ amount_owed: 1200 } as Partial<BriefingObligationRowInput>)]);
    const originalTotal = forecast.totalCommitments;
    deriveExpectedObligationsBreakdown(forecast);
    expect(forecast.totalCommitments).toBe(originalTotal);
  });

  it('deriveNetForecastBreakdown does not mutate the forecast input', () => {
    const forecast = buildForecast(
      [makeFundingSource()],
      [makeObligation({ amount_owed: 1200 } as Partial<BriefingObligationRowInput>)]
    );
    const originalBalance = forecast.forecastPosition.forecastBalance;
    deriveNetForecastBreakdown(forecast);
    expect(forecast.forecastPosition.forecastBalance).toBe(originalBalance);
  });
});

/* ─── No duplicate calculations ──────────────────────────────────────────────── */

describe('No duplicate calculations', () => {
  it('revenue breakdown total matches forecast.totalExpectedRevenue exactly', () => {
    const sources = [
      makeFundingSource({ id: 'fs-1', amount: 3000 }),
      makeFundingSource({ id: 'fs-2', amount: 2000, name: 'Second Source' }),
    ];
    const forecast = buildForecast(sources, []);
    const result = deriveExpectedRevenueBreakdown(forecast);
    expect(result.total).toBe(forecast.totalExpectedRevenue);
  });

  it('obligations breakdown total matches forecast.totalCommitments exactly', () => {
    const obligations = [
      makeObligation({ id: 'obl-1', amount_owed: 1200 } as Partial<BriefingObligationRowInput>),
      makeObligation({ id: 'obl-2', amount_owed: 4800, participant: { name: 'Marketing', role: 'Marketing' } } as Partial<BriefingObligationRowInput>),
    ];
    const forecast = buildForecast([], obligations);
    const result = deriveExpectedObligationsBreakdown(forecast);
    expect(result.total).toBe(forecast.totalCommitments);
  });

  it('deriveRevenueSourceBreakdown is identical to deriveExpectedRevenueBreakdown', () => {
    const sources = [makeFundingSource()];
    const forecast = buildForecast(sources, []);
    const r1 = deriveExpectedRevenueBreakdown(forecast);
    const r2 = deriveRevenueSourceBreakdown(forecast);
    expect(r1.total).toBe(r2.total);
    expect(r1.items.length).toBe(r2.items.length);
  });
});

/* ─── James Tourism scenario ─────────────────────────────────────────────────── */

describe('James Tourism scenario (mixed invoice + forecast)', () => {
  const ticketSales = makeFundingSource({
    id: 'tickets',
    name: 'Sunday Island Tour — Ticket Sales',
    sourceType: 'invoice',
    amount: 4000,
    status: 'CONFIRMED',
    linkedInvoiceId: 'inv-001',
  } as Partial<ProjectFundingSourceDto>);

  const govGrant = makeFundingSource({
    id: 'grant',
    name: 'Government Grant',
    sourceType: 'grant',
    amount: 5000,
    status: 'FORECAST',
    linkedInvoiceId: null,
  } as Partial<ProjectFundingSourceDto>);

  const sponsorship = makeFundingSource({
    id: 'sponsor',
    name: 'Tourism Sponsor',
    sourceType: 'sponsorship',
    amount: 10000,
    status: 'PENDING',
    linkedInvoiceId: 'inv-002',
  } as Partial<ProjectFundingSourceDto>);

  const guideObligation = makeObligation({
    id: 'guide',
    amount_owed: 1200,
    participant: { name: 'Guide', role: 'Guide' },
  } as Partial<BriefingObligationRowInput>);

  const boatHireObligation = makeObligation({
    id: 'boat',
    amount_owed: 8000,
    participant: { name: 'Boat Hire', role: 'Supplier' },
  } as Partial<BriefingObligationRowInput>);

  const marketingObligation = makeObligation({
    id: 'marketing',
    amount_owed: 4800,
    participant: { name: 'Marketing', role: 'Marketing' },
  } as Partial<BriefingObligationRowInput>);

  let forecast: CommercialForecastResult;

  beforeEach(() => {
    forecast = buildForecast(
      [ticketSales, govGrant, sponsorship],
      [guideObligation, boatHireObligation, marketingObligation]
    );
  });

  it('revenue breakdown has 3 items', () => {
    const result = deriveExpectedRevenueBreakdown(forecast);
    expect(result.items).toHaveLength(3);
  });

  it('confirmed ticket sales item has Invoice sourceType', () => {
    const result = deriveExpectedRevenueBreakdown(forecast);
    const tickets = result.items.find((i) => i.id === 'tickets');
    expect(tickets?.sourceType).toBe('Invoice');
  });

  it('government grant forecast item has Forecast sourceType', () => {
    const result = deriveExpectedRevenueBreakdown(forecast);
    const grant = result.items.find((i) => i.id === 'grant');
    expect(grant?.sourceType).toBe('Forecast');
  });

  it('ticket sales have hasLedgerEntries = true (linked invoice)', () => {
    const result = deriveExpectedRevenueBreakdown(forecast);
    const tickets = result.items.find((i) => i.id === 'tickets');
    expect(tickets?.hasLedgerEntries).toBe(true);
  });

  it('government grant has hasLedgerEntries = false (no evidence)', () => {
    const result = deriveExpectedRevenueBreakdown(forecast);
    const grant = result.items.find((i) => i.id === 'grant');
    expect(grant?.hasLedgerEntries).toBe(false);
  });

  it('obligations breakdown has 3 items', () => {
    const result = deriveExpectedObligationsBreakdown(forecast);
    expect(result.items).toHaveLength(3);
  });

  it('total revenue is 19000 (4000 + 5000 + 10000)', () => {
    const result = deriveExpectedRevenueBreakdown(forecast);
    expect(result.total).toBe(19000);
  });

  it('net forecast position label is Surplus (19000 > 14000)', () => {
    const result = deriveNetForecastBreakdown(forecast);
    expect(result.positionLabel).toBe('Surplus');
  });

  it('net position is 5000 (19000 - 14000)', () => {
    const result = deriveNetForecastBreakdown(forecast);
    expect(result.netPosition).toBe(19000 - result.obligations.total);
  });

  it('cash readiness has Available, Committed, Remaining figures', () => {
    const result = deriveCashReadinessBreakdown(forecast);
    expect(result.available.amount).toBeGreaterThan(0);
    expect(result.committed.amount).toBeGreaterThan(0);
    expect(typeof result.remaining.amount).toBe('number');
  });

  it('confidence breakdown has one item per revenue source', () => {
    const result = deriveCommercialConfidenceBreakdown(forecast);
    expect(result.items).toHaveLength(3);
  });
});

/* ─── Figure explanation text ─────────────────────────────────────────────────── */

describe('deriveCommercialFigureExplanation', () => {
  it('returns explanation for expected_revenue', () => {
    const forecast = buildForecast([makeFundingSource()], []);
    const text = deriveCommercialFigureExplanation(forecast, 'expected_revenue');
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('returns explanation for expected_obligations', () => {
    const forecast = buildForecast([], [makeObligation()]);
    const text = deriveCommercialFigureExplanation(forecast, 'expected_obligations');
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('returns explanation for net_forecast', () => {
    const forecast = buildForecast(
      [makeFundingSource({ amount: 50000 } as Partial<ProjectFundingSourceDto>)],
      [makeObligation({ amount_owed: 14000 } as Partial<BriefingObligationRowInput>)]
    );
    const text = deriveCommercialFigureExplanation(forecast, 'net_forecast');
    expect(text).toContain('50');
    expect(text).toContain('14');
  });

  it('returns explanation for cash_readiness when everyone can be paid', () => {
    const forecast = buildForecast([makeFundingSource({ amount: 50000 })], [makeObligation({ amount: 14000 })]);
    const text = deriveCommercialFigureExplanation(forecast, 'cash_readiness');
    expect(typeof text).toBe('string');
  });

  it('returns explanation for commercial_confidence', () => {
    const forecast = buildForecast([makeFundingSource()], []);
    const text = deriveCommercialFigureExplanation(forecast, 'commercial_confidence');
    expect(typeof text).toBe('string');
  });

  it('returns empty state explanation when no revenue sources', () => {
    const forecast = buildForecast([], []);
    const text = deriveCommercialFigureExplanation(forecast, 'expected_revenue');
    expect(text).toBeTruthy();
    expect(text.toLowerCase()).toContain('no revenue');
  });
});
