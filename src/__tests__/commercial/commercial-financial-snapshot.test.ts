/**
 * Commercial Financial Snapshot — regression tests
 *
 * Verifies the shared engine produces consistent financial state:
 *   - No revenue without actual revenue sources
 *   - Obligations from agreement rows only
 *   - Cash readiness requires revenue + coverage + no blockers
 *   - Dashboard and agreement surfaces get identical numbers
 */

const {
  deriveCommercialFinancialSnapshot,
  aggregateCommercialFinancialSnapshots,
} = require('../../lib/commercial/commercial-financial-snapshot');

function makeFundingSource(overrides = {}) {
  return {
    id: 'fs-1',
    projectId: 'proj-1',
    organizationId: null,
    name: 'Invoice #1001',
    description: null,
    sourceType: 'REVENUE',
    amount: 5000,
    currency: 'AUD',
    status: 'CONFIRMED',
    confidenceLevel: 'HIGH',
    expectedSettlementDate: null,
    actualSettlementDate: null,
    linkedInvoiceId: 'inv-1',
    linkedPaymentId: null,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeObligationRow(overrides = {}) {
  return {
    id: 'obl-1',
    deal_id: 'deal-1',
    obligation_type: 'fixed_fee',
    status: 'PENDING',
    amount_owed: 300,
    currency: 'AUD',
    participant: { name: 'Sarah', role: 'Performer' },
    ...overrides,
  };
}

function makeTreasury(overrides = {}) {
  return {
    currency: 'AUD',
    fundingSourceCount: 0,
    totalExpectedInflows: 0,
    confirmedFunding: 0,
    pendingFunding: 0,
    forecastFunding: 0,
    clearedFunding: 0,
    obligationsTotal: 300,
    obligationsReady: 0,
    obligationsAwaitingFunding: 300,
    operationalReadiness: 'awaiting_funding',
    projectHealth: 'forecast_heavy',
    hasFundingSources: false,
    fundingLabel: '',
    fundingSubcopy: '',
    ...overrides,
  };
}

describe('deriveCommercialFinancialSnapshot', () => {
  test('no revenue sources → zero revenue, cash readiness NO, at risk position', () => {
    const snapshot = deriveCommercialFinancialSnapshot({
      projectId: 'proj-1',
      dealId: 'deal-1',
      fundingSources: [],
      treasury: makeTreasury({ obligationsTotal: 300 }),
      obligationRows: [makeObligationRow({ amount_owed: 300 })],
      releaseConfidence: {
        level: 'BLOCKED',
        score: 20,
        currency: 'AUD',
        collectedRevenue: 0,
        reservedObligations: 300,
        readyToRelease: 0,
        heldBack: 0,
        heldBackReasons: ['No payment provider connected'],
        blockedParticipantCount: 1,
        riskWarnings: [],
        releasableObligationCount: 0,
        totalObligationCount: 1,
        explainability: { headline: 'Blocked', bullets: [] },
      },
      currency: 'AUD',
    });

    expect(snapshot.forecast.totalExpectedRevenue).toBe(0);
    expect(snapshot.forecast.totalCommitments).toBe(300);
    expect(snapshot.forecast.cashReadiness.canEveryoneBePaid).toBe(false);
    expect(snapshot.settlement.availableRevenue).toBe(0);
    expect(snapshot.settlement.waitingToCollect).toBe(0);
    expect(snapshot.hasRevenueSources).toBe(false);
    expect(snapshot.health.level).toBe('blocked');
  });

  test('obligations always equal agreement obligation rows', () => {
    const snapshot = deriveCommercialFinancialSnapshot({
      projectId: 'proj-1',
      dealId: 'deal-1',
      fundingSources: [],
      treasury: makeTreasury({ obligationsTotal: 9999 }),
      obligationRows: [makeObligationRow({ amount_owed: 300 })],
      releaseConfidence: null,
      currency: 'AUD',
    });

    expect(snapshot.forecast.totalCommitments).toBe(300);
  });

  test('revenue only from funding sources, not treasury aggregates', () => {
    const snapshot = deriveCommercialFinancialSnapshot({
      projectId: 'proj-1',
      dealId: 'deal-1',
      fundingSources: [],
      treasury: makeTreasury({ confirmedFunding: 50000, pendingFunding: 10000 }),
      obligationRows: [makeObligationRow({ amount_owed: 300 })],
      releaseConfidence: null,
      currency: 'AUD',
    });

    expect(snapshot.forecast.totalExpectedRevenue).toBe(0);
    expect(snapshot.hasRevenueSources).toBe(false);
  });

  test('with revenue source and obligations → net forecast = revenue − obligations', () => {
    const snapshot = deriveCommercialFinancialSnapshot({
      projectId: 'proj-1',
      dealId: 'deal-1',
      fundingSources: [makeFundingSource({ amount: 5000 })],
      treasury: makeTreasury(),
      obligationRows: [makeObligationRow({ amount_owed: 300 })],
      releaseConfidence: {
        level: 'HIGH',
        score: 90,
        currency: 'AUD',
        collectedRevenue: 5000,
        reservedObligations: 300,
        readyToRelease: 300,
        heldBack: 0,
        heldBackReasons: [],
        blockedParticipantCount: 0,
        riskWarnings: [],
        releasableObligationCount: 1,
        totalObligationCount: 1,
        explainability: { headline: 'Ready', bullets: [] },
      },
      currency: 'AUD',
    });

    expect(snapshot.forecast.totalExpectedRevenue).toBe(5000);
    expect(snapshot.forecast.totalCommitments).toBe(300);
    expect(snapshot.forecast.forecastPosition.forecastBalance).toBe(4700);
    expect(snapshot.forecast.cashReadiness.canEveryoneBePaid).toBe(true);
    expect(snapshot.settlement.availableRevenue).toBe(5000);
    expect(snapshot.settlement.settlementReadiness).toBe(true);
  });

  test('cash readiness NO when settlement blockers exist even with surplus', () => {
    const snapshot = deriveCommercialFinancialSnapshot({
      projectId: 'proj-1',
      dealId: 'deal-1',
      fundingSources: [makeFundingSource({ amount: 5000 })],
      treasury: makeTreasury(),
      obligationRows: [makeObligationRow({ amount_owed: 300 })],
      releaseConfidence: {
        level: 'BLOCKED',
        score: 30,
        currency: 'AUD',
        collectedRevenue: 5000,
        reservedObligations: 300,
        readyToRelease: 0,
        heldBack: 5000,
        heldBackReasons: ['Payment provider not connected'],
        blockedParticipantCount: 1,
        riskWarnings: [],
        releasableObligationCount: 0,
        totalObligationCount: 1,
        explainability: { headline: 'Blocked', bullets: [] },
      },
      currency: 'AUD',
    });

    expect(snapshot.forecast.forecastPosition.forecastBalance).toBeGreaterThan(0);
    expect(snapshot.forecast.cashReadiness.canEveryoneBePaid).toBe(false);
  });

  test('identical inputs produce identical snapshots (determinism)', () => {
    const input = {
      projectId: 'proj-1',
      dealId: 'deal-1',
      fundingSources: [makeFundingSource()],
      treasury: makeTreasury(),
      obligationRows: [makeObligationRow()],
      releaseConfidence: null,
      currency: 'AUD',
    };

    const a = deriveCommercialFinancialSnapshot(input);
    const b = deriveCommercialFinancialSnapshot(input);

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('aggregateCommercialFinancialSnapshots', () => {
  test('aggregates revenue and obligations across agreements', () => {
    const snap1 = deriveCommercialFinancialSnapshot({
      projectId: 'p1',
      dealId: 'd1',
      fundingSources: [makeFundingSource({ amount: 1000 })],
      treasury: null,
      obligationRows: [makeObligationRow({ amount_owed: 100 })],
      releaseConfidence: null,
      currency: 'AUD',
    });

    const snap2 = deriveCommercialFinancialSnapshot({
      projectId: 'p2',
      dealId: 'd2',
      fundingSources: [makeFundingSource({ amount: 2000, id: 'fs-2' })],
      treasury: null,
      obligationRows: [makeObligationRow({ amount_owed: 200, id: 'obl-2' })],
      releaseConfidence: null,
      currency: 'AUD',
    });

    const aggregated = aggregateCommercialFinancialSnapshots([snap1, snap2], 'AUD');

    expect(aggregated?.forecast.totalExpectedRevenue).toBe(3000);
    expect(aggregated?.forecast.totalCommitments).toBe(300);
    expect(aggregated?.settlement.availableRevenue).toBe(3000);
  });
});
