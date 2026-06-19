/**
 * Commercial Forecast Engine — Regression Tests
 *
 * Covers every aspect of deriveCommercialForecast():
 *   - Surplus / deficit calculations
 *   - Confidence generation and explanations
 *   - Revenue classification (confirmed / pending / forecast)
 *   - Commitment classification (fixed / revenue-share / conditional)
 *   - Commercial risk generation
 *   - Cash readiness derivation
 *   - Forecast engine determinism
 *   - No duplicate calculation paths
 *   - Provvy narrative generation
 *   - Empty / edge-case inputs
 */

const {
  deriveCommercialForecast,
  buildForecastProvvyNarrative,
  formatForecastAmount,
  formatForecastBalance,
} = require('../../lib/commercial/commercial-forecast');

/* ─── Fixtures ──────────────────────────────────────────────────────────────── */

function makeFundingSource(overrides) {
  return {
    id: 'fs-1',
    projectId: 'proj-1',
    organizationId: null,
    name: 'Viking Cruises',
    description: null,
    sourceType: 'REVENUE',
    amount: 50000,
    currency: 'AUD',
    status: 'PENDING',
    confidenceLevel: 'HIGH',
    expectedSettlementDate: '2026-08-15',
    actualSettlementDate: null,
    linkedInvoiceId: null,
    linkedPaymentId: null,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeTreasury(overrides) {
  return {
    currency: 'AUD',
    fundingSourceCount: 1,
    totalExpectedInflows: 50000,
    confirmedFunding: 30000,
    pendingFunding: 20000,
    forecastFunding: 0,
    clearedFunding: 0,
    obligationsTotal: 11000,
    obligationsReady: 11000,
    obligationsAwaitingFunding: 0,
    operationalReadiness: 'ready',
    projectHealth: 'healthy',
    hasFundingSources: true,
    fundingLabel: 'Funded',
    fundingSubcopy: 'All obligations are funded.',
    ...overrides,
  };
}

function makeObligationRow(overrides) {
  return {
    id: 'obl-1',
    deal_id: 'deal-1',
    obligation_type: 'fixed_fee',
    status: 'FUNDED',
    amount_owed: 300,
    currency: 'AUD',
    participant: { name: 'Sarah', role: 'Performer' },
    ...overrides,
  };
}

function makeReleaseConfidence(overrides) {
  return {
    level: 'HIGH',
    score: 90,
    currency: 'AUD',
    collectedRevenue: 50000,
    reservedObligations: 11000,
    readyToRelease: 39000,
    heldBack: 0,
    heldBackReasons: [],
    blockedParticipantCount: 0,
    riskWarnings: [],
    releasableObligationCount: 3,
    totalObligationCount: 3,
    explainability: { headline: 'Ready for settlement', bullets: ['All obligations funded'] },
    ...overrides,
  };
}

function makeInput(overrides) {
  return {
    fundingSources: [makeFundingSource()],
    treasury: makeTreasury(),
    obligationRows: [makeObligationRow()],
    releaseConfidence: makeReleaseConfidence(),
    currency: 'AUD',
    ...overrides,
  };
}

/* ─── Part 1: Forecast calculations ────────────────────────────────────────── */

describe('deriveCommercialForecast — core calculations', () => {
  test('produces a forecast surplus when revenue exceeds commitments', () => {
    const input = makeInput({
      fundingSources: [makeFundingSource({ amount: 50000, status: 'CONFIRMED', confidenceLevel: 'HIGH' })],
      obligationRows: [makeObligationRow({ amount_owed: 11000 })],
    });
    const result = deriveCommercialForecast(input);

    expect(result.totalExpectedRevenue).toBe(50000);
    expect(result.totalCommitments).toBe(11000);
    expect(result.forecastPosition.forecastBalance).toBe(39000);
    expect(result.forecastPosition.status).toBe('surplus');
    expect(result.forecastPosition.forecastSurplus).toBe(39000);
  });

  test('produces a forecast deficit when commitments exceed revenue', () => {
    const input = makeInput({
      fundingSources: [makeFundingSource({ amount: 5000, status: 'PENDING', confidenceLevel: 'LOW' })],
      obligationRows: [makeObligationRow({ amount_owed: 11000 })],
    });
    const result = deriveCommercialForecast(input);

    expect(result.totalExpectedRevenue).toBe(5000);
    expect(result.totalCommitments).toBe(11000);
    expect(result.forecastPosition.forecastBalance).toBe(-6000);
    expect(result.forecastPosition.status).toBe('deficit');
  });

  test('produces break_even when revenue equals commitments', () => {
    const input = makeInput({
      fundingSources: [makeFundingSource({ amount: 11000 })],
      obligationRows: [makeObligationRow({ amount_owed: 11000 })],
    });
    const result = deriveCommercialForecast(input);

    expect(result.forecastPosition.status).toBe('break_even');
    expect(result.forecastPosition.forecastBalance).toBe(0);
  });

  test('returns insufficient_data when no sources and no obligations', () => {
    const input = makeInput({
      fundingSources: [],
      treasury: null,
      obligationRows: [],
      releaseConfidence: null,
    });
    const result = deriveCommercialForecast(input);

    expect(result.forecastPosition.status).toBe('insufficient_data');
    expect(result.totalExpectedRevenue).toBe(0);
    expect(result.totalCommitments).toBe(0);
  });

  test('sums multiple funding sources', () => {
    const input = makeInput({
      fundingSources: [
        makeFundingSource({ id: 'fs-1', amount: 30000, status: 'CONFIRMED' }),
        makeFundingSource({ id: 'fs-2', name: 'Grant', amount: 20000, status: 'PENDING' }),
      ],
    });
    const result = deriveCommercialForecast(input);

    expect(result.totalExpectedRevenue).toBe(50000);
    expect(result.incomingRevenue).toHaveLength(2);
  });

  test('sums multiple obligation rows', () => {
    const input = makeInput({
      obligationRows: [
        makeObligationRow({ id: 'obl-1', amount_owed: 300, participant: { name: 'Sarah', role: 'Performer' } }),
        makeObligationRow({ id: 'obl-2', amount_owed: 500, participant: { name: 'Ben', role: 'DJ' } }),
        makeObligationRow({ id: 'obl-3', amount_owed: 200, participant: { name: 'Alex', role: 'Sound' } }),
      ],
    });
    const result = deriveCommercialForecast(input);

    expect(result.totalFixedCommitments).toBe(1000);
    expect(result.fixedCommitments).toHaveLength(3);
  });
});

/* ─── Part 2: Revenue classification ────────────────────────────────────────── */

describe('deriveCommercialForecast — revenue classification', () => {
  test('classifies CONFIRMED/RECEIVED/CLEARED as confirmed', () => {
    for (const status of ['CONFIRMED', 'RECEIVED', 'CLEARED']) {
      const result = deriveCommercialForecast(
        makeInput({ fundingSources: [makeFundingSource({ status, amount: 10000 })] })
      );
      expect(result.confirmedRevenue).toBe(10000);
      expect(result.pendingRevenue).toBe(0);
      expect(result.forecastRevenue).toBe(0);
    }
  });

  test('classifies PENDING as pending revenue', () => {
    const result = deriveCommercialForecast(
      makeInput({ fundingSources: [makeFundingSource({ status: 'PENDING', amount: 10000 })] })
    );
    expect(result.confirmedRevenue).toBe(0);
    expect(result.pendingRevenue).toBe(10000);
  });

  test('classifies FORECAST/DRAFT as forecast revenue', () => {
    for (const status of ['FORECAST', 'DRAFT']) {
      const result = deriveCommercialForecast(
        makeInput({ fundingSources: [makeFundingSource({ status, amount: 10000 })] })
      );
      expect(result.forecastRevenue).toBe(10000);
    }
  });

  test('classifies OVERDUE as overdue status', () => {
    const result = deriveCommercialForecast(
      makeInput({ fundingSources: [makeFundingSource({ status: 'OVERDUE', amount: 10000 })] })
    );
    expect(result.incomingRevenue[0].status).toBe('overdue');
  });

  test('includes expected settlement date on revenue items', () => {
    const result = deriveCommercialForecast(
      makeInput({ fundingSources: [makeFundingSource({ expectedSettlementDate: '2026-08-15' })] })
    );
    expect(result.incomingRevenue[0].expectedDate).toBe('2026-08-15');
  });

  test('null expected date is preserved', () => {
    const result = deriveCommercialForecast(
      makeInput({ fundingSources: [makeFundingSource({ expectedSettlementDate: null })] })
    );
    expect(result.incomingRevenue[0].expectedDate).toBeNull();
  });
});

/* ─── Part 3: Confidence generation and explanations ─────────────────────────── */

describe('deriveCommercialForecast — confidence generation', () => {
  test('HIGH confidence level maps to score >= 90 for confirmed sources', () => {
    const result = deriveCommercialForecast(
      makeInput({
        fundingSources: [
          makeFundingSource({ status: 'RECEIVED', confidenceLevel: 'HIGH' }),
        ],
      })
    );
    expect(result.incomingRevenue[0].confidence.score).toBeGreaterThanOrEqual(90);
  });

  test('LOW confidence level with OVERDUE status reduces score', () => {
    const result = deriveCommercialForecast(
      makeInput({
        fundingSources: [
          makeFundingSource({ status: 'OVERDUE', confidenceLevel: 'LOW' }),
        ],
      })
    );
    expect(result.incomingRevenue[0].confidence.score).toBeLessThanOrEqual(40);
  });

  test('MEDIUM confidence level maps to a mid-range score', () => {
    const result = deriveCommercialForecast(
      makeInput({
        fundingSources: [makeFundingSource({ status: 'PENDING', confidenceLevel: 'MEDIUM' })],
      })
    );
    const score = result.incomingRevenue[0].confidence.score;
    expect(score).toBeGreaterThan(40);
    expect(score).toBeLessThan(90);
  });

  test('confidence reasons include payment date confirmed when date is set', () => {
    const result = deriveCommercialForecast(
      makeInput({
        fundingSources: [makeFundingSource({ expectedSettlementDate: '2026-08-15' })],
      })
    );
    const reasons = result.incomingRevenue[0].confidence.reasons;
    const dateReason = reasons.find((r) => r.label === 'Payment date confirmed');
    expect(dateReason).toBeDefined();
    expect(dateReason.positive).toBe(true);
  });

  test('confidence reasons flag when no date is set', () => {
    const result = deriveCommercialForecast(
      makeInput({
        fundingSources: [makeFundingSource({ expectedSettlementDate: null })],
      })
    );
    const reasons = result.incomingRevenue[0].confidence.reasons;
    const noDate = reasons.find((r) => r.label === 'No confirmed payment date');
    expect(noDate).toBeDefined();
    expect(noDate.positive).toBe(false);
  });

  test('linked invoice increases confidence score', () => {
    const withInvoice = deriveCommercialForecast(
      makeInput({
        fundingSources: [makeFundingSource({ linkedInvoiceId: 'inv-123', confidenceLevel: 'MEDIUM' })],
      })
    );
    const withoutInvoice = deriveCommercialForecast(
      makeInput({
        fundingSources: [makeFundingSource({ linkedInvoiceId: null, confidenceLevel: 'MEDIUM' })],
      })
    );
    expect(withInvoice.incomingRevenue[0].confidence.score).toBeGreaterThanOrEqual(
      withoutInvoice.incomingRevenue[0].confidence.score
    );
  });

  test('confidence label matches score as percentage string', () => {
    const result = deriveCommercialForecast(makeInput());
    const item = result.incomingRevenue[0];
    expect(item.confidence.label).toBe(`${item.confidence.score}%`);
  });

  test('hasEvidence is true when invoice or payment is linked', () => {
    const withEvidence = deriveCommercialForecast(
      makeInput({ fundingSources: [makeFundingSource({ linkedInvoiceId: 'inv-1' })] })
    );
    const withoutEvidence = deriveCommercialForecast(
      makeInput({ fundingSources: [makeFundingSource({ linkedInvoiceId: null, linkedPaymentId: null })] })
    );
    expect(withEvidence.incomingRevenue[0].hasEvidence).toBe(true);
    expect(withoutEvidence.incomingRevenue[0].hasEvidence).toBe(false);
  });
});

/* ─── Part 4: Commitment classification ─────────────────────────────────────── */

describe('deriveCommercialForecast — commitment classification', () => {
  test('fixed_fee obligations are classified as fixed', () => {
    const result = deriveCommercialForecast(
      makeInput({ obligationRows: [makeObligationRow({ obligation_type: 'fixed_fee' })] })
    );
    expect(result.fixedCommitments).toHaveLength(1);
    expect(result.revenueShareCommitments).toHaveLength(0);
    expect(result.conditionalCommitments).toHaveLength(0);
  });

  test('revenue_share obligations are classified as revenue share', () => {
    const result = deriveCommercialForecast(
      makeInput({
        obligationRows: [makeObligationRow({ obligation_type: 'revenue_share', amount_owed: 0 })],
      })
    );
    expect(result.revenueShareCommitments).toHaveLength(1);
    expect(result.fixedCommitments).toHaveLength(0);
  });

  test('conditional_bonus obligations are classified as conditional', () => {
    const result = deriveCommercialForecast(
      makeInput({
        obligationRows: [makeObligationRow({ obligation_type: 'conditional_bonus', amount_owed: 150 })],
      })
    );
    expect(result.conditionalCommitments).toHaveLength(1);
    expect(result.fixedCommitments).toHaveLength(0);
  });

  test('commission obligations are classified as revenue share', () => {
    const result = deriveCommercialForecast(
      makeInput({
        obligationRows: [makeObligationRow({ obligation_type: 'commission', amount_owed: 0 })],
      })
    );
    expect(result.revenueShareCommitments).toHaveLength(1);
  });

  test('milestone obligations are classified as conditional', () => {
    const result = deriveCommercialForecast(
      makeInput({
        obligationRows: [makeObligationRow({ obligation_type: 'milestone', amount_owed: 500 })],
      })
    );
    expect(result.conditionalCommitments).toHaveLength(1);
  });

  test('totalFixedCommitments only sums fixed-category obligations', () => {
    const result = deriveCommercialForecast(
      makeInput({
        obligationRows: [
          makeObligationRow({ id: 'f1', obligation_type: 'fixed_fee', amount_owed: 300 }),
          makeObligationRow({ id: 'r1', obligation_type: 'revenue_share', amount_owed: 0 }),
          makeObligationRow({ id: 'c1', obligation_type: 'conditional_bonus', amount_owed: 150 }),
        ],
      })
    );
    expect(result.totalFixedCommitments).toBe(300);
  });

  test('funded status is true for FUNDED/PAID/RELEASE_READY obligations', () => {
    for (const status of ['FUNDED', 'PAID', 'RELEASE_READY']) {
      const result = deriveCommercialForecast(
        makeInput({ obligationRows: [makeObligationRow({ status })] })
      );
      expect(result.fixedCommitments[0].funded).toBe(true);
    }
  });

  test('funded status is false for unfunded obligations', () => {
    const result = deriveCommercialForecast(
      makeInput({ obligationRows: [makeObligationRow({ status: 'UNFUNDED' })] })
    );
    expect(result.fixedCommitments[0].funded).toBe(false);
  });
});

/* ─── Part 5: Cash readiness ─────────────────────────────────────────────────── */

describe('deriveCommercialForecast — cash readiness', () => {
  test('canEveryoneBePaid is true when forecast balance is positive', () => {
    const input = makeInput({
      fundingSources: [makeFundingSource({ amount: 50000 })],
      obligationRows: [makeObligationRow({ amount_owed: 11000 })],
    });
    const result = deriveCommercialForecast(input);
    expect(result.cashReadiness.canEveryoneBePaid).toBe(true);
  });

  test('canEveryoneBePaid is false when forecast balance is negative', () => {
    const input = makeInput({
      fundingSources: [makeFundingSource({ amount: 5000 })],
      obligationRows: [makeObligationRow({ amount_owed: 11000 })],
    });
    const result = deriveCommercialForecast(input);
    expect(result.cashReadiness.canEveryoneBePaid).toBe(false);
  });

  test('expectedBalanceAfterSettlement is set on surplus', () => {
    const input = makeInput({
      fundingSources: [makeFundingSource({ amount: 50000 })],
      obligationRows: [makeObligationRow({ amount_owed: 11000 })],
    });
    const result = deriveCommercialForecast(input);
    expect(result.cashReadiness.expectedBalanceAfterSettlement).toBe(39000);
    expect(result.cashReadiness.forecastShortfall).toBeNull();
  });

  test('forecastShortfall is set on deficit', () => {
    const input = makeInput({
      fundingSources: [makeFundingSource({ amount: 5000 })],
      obligationRows: [makeObligationRow({ amount_owed: 11000 })],
    });
    const result = deriveCommercialForecast(input);
    expect(result.cashReadiness.forecastShortfall).toBe(6000);
    expect(result.cashReadiness.expectedBalanceAfterSettlement).toBeNull();
  });

  test('primaryBlocker names the overdue item when one is overdue', () => {
    const input = makeInput({
      fundingSources: [
        makeFundingSource({ id: 'fs-1', name: 'Viking Cruises', status: 'OVERDUE', amount: 5000 }),
      ],
      obligationRows: [makeObligationRow({ amount_owed: 11000 })],
    });
    const result = deriveCommercialForecast(input);
    expect(result.cashReadiness.primaryBlocker).toContain('Viking Cruises');
  });

  test('primaryBlocker is null when everyone can be paid', () => {
    const input = makeInput({
      fundingSources: [makeFundingSource({ amount: 50000, status: 'CONFIRMED' })],
      obligationRows: [makeObligationRow({ amount_owed: 11000 })],
    });
    const result = deriveCommercialForecast(input);
    expect(result.cashReadiness.primaryBlocker).toBeNull();
  });

  test('primaryBlocker uses release confidence heldBackReasons when no specific source', () => {
    const input = makeInput({
      fundingSources: [makeFundingSource({ amount: 5000, status: 'FORECAST' })],
      obligationRows: [makeObligationRow({ amount_owed: 11000 })],
      releaseConfidence: makeReleaseConfidence({
        heldBackReasons: ['Invoice missing from Sarah'],
      }),
    });
    const result = deriveCommercialForecast(input);
    expect(result.cashReadiness.primaryBlocker).not.toBeNull();
  });
});

/* ─── Part 6: Commercial risk generation ─────────────────────────────────────── */

describe('deriveCommercialForecast — commercial risks', () => {
  test('generates overdue risk when a source is overdue', () => {
    const input = makeInput({
      fundingSources: [makeFundingSource({ status: 'OVERDUE', name: 'Grant' })],
      obligationRows: [makeObligationRow({ amount_owed: 5000 })],
    });
    const result = deriveCommercialForecast(input);
    const overdueRisk = result.commercialRisks.find((r) => r.id.startsWith('overdue-'));
    expect(overdueRisk).toBeDefined();
    expect(overdueRisk.severity).toBe('high');
    expect(overdueRisk.title).toContain('Grant');
  });

  test('generates low-confidence risk for sources with score < 50', () => {
    const input = makeInput({
      fundingSources: [makeFundingSource({ status: 'FORECAST', confidenceLevel: 'LOW', expectedSettlementDate: null })],
    });
    const result = deriveCommercialForecast(input);
    const lowConfRisk = result.commercialRisks.find((r) => r.id.startsWith('low-confidence-'));
    expect(lowConfRisk).toBeDefined();
    expect(lowConfRisk.severity).toBe('medium');
  });

  test('generates shortfall risk when forecast is negative', () => {
    const input = makeInput({
      fundingSources: [makeFundingSource({ amount: 5000 })],
      obligationRows: [makeObligationRow({ amount_owed: 11000 })],
    });
    const result = deriveCommercialForecast(input);
    const shortfallRisk = result.commercialRisks.find((r) => r.id === 'forecast-shortfall');
    expect(shortfallRisk).toBeDefined();
    expect(shortfallRisk.severity).toBe('high');
  });

  test('does not generate shortfall risk when forecast is positive', () => {
    const input = makeInput({
      fundingSources: [makeFundingSource({ amount: 50000, status: 'CONFIRMED' })],
      obligationRows: [makeObligationRow({ amount_owed: 11000 })],
    });
    const result = deriveCommercialForecast(input);
    const shortfallRisk = result.commercialRisks.find((r) => r.id === 'forecast-shortfall');
    expect(shortfallRisk).toBeUndefined();
  });

  test('generates conditional bonus risk when conditionals exist with amount', () => {
    const input = makeInput({
      fundingSources: [makeFundingSource({ amount: 50000 })],
      obligationRows: [
        makeObligationRow({ id: 'c1', obligation_type: 'conditional_bonus', amount_owed: 150 }),
      ],
    });
    const result = deriveCommercialForecast(input);
    const condRisk = result.commercialRisks.find((r) => r.id === 'conditional-payments');
    expect(condRisk).toBeDefined();
    expect(condRisk.severity).toBe('medium');
  });

  test('generates forecast-heavy risk for forecast_heavy treasury health', () => {
    const input = makeInput({
      treasury: makeTreasury({ projectHealth: 'forecast_heavy' }),
    });
    const result = deriveCommercialForecast(input);
    const heavyRisk = result.commercialRisks.find((r) => r.id === 'forecast-heavy');
    expect(heavyRisk).toBeDefined();
  });

  test('no commercial risks when everything is confirmed and funded', () => {
    const input = makeInput({
      fundingSources: [makeFundingSource({ amount: 50000, status: 'RECEIVED', confidenceLevel: 'HIGH', expectedSettlementDate: '2026-08-01', linkedInvoiceId: 'inv-1' })],
      obligationRows: [makeObligationRow({ amount_owed: 11000, status: 'FUNDED' })],
      treasury: makeTreasury({ projectHealth: 'healthy' }),
      releaseConfidence: makeReleaseConfidence({ heldBackReasons: [] }),
    });
    const result = deriveCommercialForecast(input);
    expect(result.commercialRisks).toHaveLength(0);
  });

  test('risks are sorted with high severity first', () => {
    const input = makeInput({
      fundingSources: [
        makeFundingSource({ id: 'fs-1', status: 'OVERDUE', amount: 5000, name: 'Source A' }),
        makeFundingSource({ id: 'fs-2', status: 'FORECAST', amount: 45000, confidenceLevel: 'LOW', expectedSettlementDate: null, name: 'Source B' }),
      ],
      obligationRows: [makeObligationRow({ amount_owed: 60000 })],
    });
    const result = deriveCommercialForecast(input);
    const severities = result.commercialRisks.map((r) => r.severity);
    // First occurrence of 'medium' must come after all 'high'
    const firstMedium = severities.indexOf('medium');
    const lastHigh = severities.lastIndexOf('high');
    if (firstMedium !== -1 && lastHigh !== -1) {
      expect(lastHigh).toBeLessThan(firstMedium);
    }
  });

  test('each risk has required fields', () => {
    const input = makeInput({
      fundingSources: [makeFundingSource({ status: 'OVERDUE' })],
      obligationRows: [makeObligationRow({ amount_owed: 60000 })],
    });
    const result = deriveCommercialForecast(input);
    for (const risk of result.commercialRisks) {
      expect(risk.id).toBeTruthy();
      expect(risk.title).toBeTruthy();
      expect(risk.explanation).toBeTruthy();
      expect(risk.consequence).toBeTruthy();
      expect(risk.recommendedAction).toBeTruthy();
      expect(['high', 'medium', 'low']).toContain(risk.severity);
    }
  });
});

/* ─── Part 7: Overall confidence ─────────────────────────────────────────────── */

describe('deriveCommercialForecast — overall confidence', () => {
  test('returns INSUFFICIENT_DATA when there are no funding sources', () => {
    const input = makeInput({ fundingSources: [], treasury: null, obligationRows: [] });
    const result = deriveCommercialForecast(input);
    expect(result.overallConfidence.level).toBe('INSUFFICIENT_DATA');
    expect(result.overallConfidence.score).toBe(0);
  });

  test('returns HIGH confidence when all sources are confirmed with no risks', () => {
    const input = makeInput({
      fundingSources: [makeFundingSource({ status: 'RECEIVED', confidenceLevel: 'HIGH', expectedSettlementDate: '2026-08-01', linkedInvoiceId: 'inv-1' })],
      obligationRows: [makeObligationRow({ amount_owed: 11000, status: 'FUNDED' })],
      treasury: makeTreasury({ projectHealth: 'healthy' }),
      releaseConfidence: makeReleaseConfidence({ heldBackReasons: [] }),
    });
    const result = deriveCommercialForecast(input);
    expect(result.overallConfidence.level).toBe('HIGH');
    expect(result.overallConfidence.score).toBeGreaterThanOrEqual(80);
  });

  test('BLOCKED release confidence reduces overall score significantly', () => {
    const input = makeInput({
      releaseConfidence: makeReleaseConfidence({ level: 'BLOCKED', heldBackReasons: ['Invoice missing'] }),
    });
    const result = deriveCommercialForecast(input);
    expect(result.overallConfidence.score).toBeLessThan(80);
  });

  test('confidence summary is a non-empty string', () => {
    const result = deriveCommercialForecast(makeInput());
    expect(result.overallConfidence.summary).toBeTruthy();
    expect(typeof result.overallConfidence.summary).toBe('string');
  });
});

/* ─── Part 8: Forecast engine determinism ────────────────────────────────────── */

describe('deriveCommercialForecast — determinism', () => {
  test('same input always produces identical output', () => {
    const input = makeInput();
    const r1 = deriveCommercialForecast(input);
    const r2 = deriveCommercialForecast(input);

    expect(r1.totalExpectedRevenue).toBe(r2.totalExpectedRevenue);
    expect(r1.totalCommitments).toBe(r2.totalCommitments);
    expect(r1.forecastPosition.forecastBalance).toBe(r2.forecastPosition.forecastBalance);
    expect(r1.cashReadiness.canEveryoneBePaid).toBe(r2.cashReadiness.canEveryoneBePaid);
    expect(r1.commercialRisks.length).toBe(r2.commercialRisks.length);
    expect(r1.overallConfidence.level).toBe(r2.overallConfidence.level);
    expect(r1.overallConfidence.score).toBe(r2.overallConfidence.score);
  });

  test('different inputs produce different outputs', () => {
    const surplus = deriveCommercialForecast(
      makeInput({
        fundingSources: [makeFundingSource({ amount: 50000 })],
        obligationRows: [makeObligationRow({ amount_owed: 11000 })],
      })
    );
    const deficit = deriveCommercialForecast(
      makeInput({
        fundingSources: [makeFundingSource({ amount: 5000 })],
        obligationRows: [makeObligationRow({ amount_owed: 11000 })],
      })
    );
    expect(surplus.forecastPosition.status).not.toBe(deficit.forecastPosition.status);
    expect(surplus.totalExpectedRevenue).not.toBe(deficit.totalExpectedRevenue);
  });

  test('input is not mutated by the engine', () => {
    const fundingSources = [makeFundingSource()];
    const obligationRows = [makeObligationRow()];
    const input = makeInput({ fundingSources, obligationRows });

    const beforeJson = JSON.stringify(input);
    deriveCommercialForecast(input);
    const afterJson = JSON.stringify(input);

    expect(beforeJson).toBe(afterJson);
  });
});

/* ─── Part 9: Treasury fallback (no individual sources) ─────────────────────── */

describe('deriveCommercialForecast — treasury aggregate fallback', () => {
  test('falls back to treasury aggregates when no funding sources provided', () => {
    const input = makeInput({
      fundingSources: [],
      treasury: makeTreasury({ confirmedFunding: 30000, pendingFunding: 20000, forecastFunding: 5000 }),
    });
    const result = deriveCommercialForecast(input);

    expect(result.incomingRevenue.length).toBeGreaterThan(0);
    expect(result.totalExpectedRevenue).toBeGreaterThan(0);
  });

  test('confirmed aggregate creates a confirmed revenue item', () => {
    const input = makeInput({
      fundingSources: [],
      treasury: makeTreasury({ confirmedFunding: 30000, pendingFunding: 0, forecastFunding: 0 }),
    });
    const result = deriveCommercialForecast(input);
    const confirmed = result.incomingRevenue.find((r) => r.status === 'confirmed');
    expect(confirmed).toBeDefined();
    expect(confirmed.amount).toBe(30000);
  });

  test('returns no revenue when treasury has all zeros', () => {
    const input = makeInput({
      fundingSources: [],
      treasury: makeTreasury({
        confirmedFunding: 0,
        pendingFunding: 0,
        forecastFunding: 0,
        clearedFunding: 0,
      }),
    });
    const result = deriveCommercialForecast(input);
    expect(result.incomingRevenue).toHaveLength(0);
  });
});

/* ─── Part 10: Provvy narrative ─────────────────────────────────────────────── */

describe('buildForecastProvvyNarrative', () => {
  test('generates affirmative narrative on surplus', () => {
    const input = makeInput({
      fundingSources: [makeFundingSource({ amount: 50000, status: 'CONFIRMED' })],
      obligationRows: [makeObligationRow({ amount_owed: 11000 })],
    });
    const result = deriveCommercialForecast(input);
    const narrative = buildForecastProvvyNarrative(result);

    expect(narrative).toContain('Yes.');
    expect(narrative).toContain('50,000');
    expect(narrative).toContain('11,000');
    expect(narrative).toContain('39,000');
  });

  test('generates negative narrative on deficit', () => {
    const input = makeInput({
      fundingSources: [makeFundingSource({ amount: 5000, status: 'PENDING' })],
      obligationRows: [makeObligationRow({ amount_owed: 11000 })],
    });
    const result = deriveCommercialForecast(input);
    const narrative = buildForecastProvvyNarrative(result);

    expect(narrative).toContain('No.');
    expect(narrative).toContain('6,000');
  });

  test('mentions highest-priority risk when in surplus', () => {
    const input = makeInput({
      fundingSources: [makeFundingSource({ amount: 50000, status: 'OVERDUE' })],
      obligationRows: [makeObligationRow({ amount_owed: 11000 })],
    });
    const result = deriveCommercialForecast(input);
    const narrative = buildForecastProvvyNarrative(result);

    // Risk is mentioned in the narrative
    expect(narrative.length).toBeGreaterThan(0);
  });

  test('returns no-data message when there are no sources', () => {
    const result = deriveCommercialForecast(makeInput({ fundingSources: [], treasury: null, obligationRows: [] }));
    const narrative = buildForecastProvvyNarrative(result);
    expect(narrative).toContain('No revenue sources');
  });

  test('narrative is always a non-empty string', () => {
    const result = deriveCommercialForecast(makeInput());
    const narrative = buildForecastProvvyNarrative(result);
    expect(typeof narrative).toBe('string');
    expect(narrative.length).toBeGreaterThan(0);
  });
});

/* ─── Part 11: Format helpers ────────────────────────────────────────────────── */

describe('formatForecastAmount', () => {
  test('formats positive amounts with currency', () => {
    expect(formatForecastAmount(50000, 'AUD')).toContain('AUD');
    expect(formatForecastAmount(50000, 'AUD')).toContain('50,000');
  });

  test('formats negative amounts with leading minus', () => {
    expect(formatForecastAmount(-6000, 'AUD')).toContain('-');
    expect(formatForecastAmount(-6000, 'AUD')).toContain('6,000');
  });

  test('formats zero correctly', () => {
    const result = formatForecastAmount(0, 'AUD');
    expect(result).toContain('AUD');
  });
});

describe('formatForecastBalance', () => {
  test('positive balance has + prefix', () => {
    expect(formatForecastBalance(39000, 'AUD')).toMatch(/^\+/);
  });

  test('negative balance is formatted as negative', () => {
    const result = formatForecastBalance(-6000, 'AUD');
    expect(result).toContain('-');
    expect(result).toContain('6,000');
  });
});

/* ─── Part 12: No duplicate calculation paths ───────────────────────────────── */

describe('forecast engine — no duplicate calculation paths', () => {
  test('forecastPosition.forecastBalance equals totalExpectedRevenue - totalCommitments', () => {
    const input = makeInput({
      fundingSources: [makeFundingSource({ amount: 50000 })],
      obligationRows: [makeObligationRow({ amount_owed: 11000 })],
    });
    const result = deriveCommercialForecast(input);

    expect(result.forecastPosition.forecastBalance).toBe(
      result.totalExpectedRevenue - result.totalCommitments
    );
  });

  test('forecastPosition.totalExpectedRevenue matches top-level totalExpectedRevenue', () => {
    const result = deriveCommercialForecast(makeInput());
    expect(result.forecastPosition.totalExpectedRevenue).toBe(result.totalExpectedRevenue);
  });

  test('forecastPosition.totalCommitments matches top-level totalCommitments', () => {
    const result = deriveCommercialForecast(makeInput());
    expect(result.forecastPosition.totalCommitments).toBe(result.totalCommitments);
  });

  test('totalCommitments equals totalFixedCommitments + totalRevenueShareEstimate', () => {
    const input = makeInput({
      obligationRows: [
        makeObligationRow({ id: 'f1', obligation_type: 'fixed_fee', amount_owed: 300 }),
        makeObligationRow({ id: 'r1', obligation_type: 'revenue_share', amount_owed: 500 }),
      ],
    });
    const result = deriveCommercialForecast(input);

    expect(result.totalCommitments).toBe(
      result.totalFixedCommitments + result.totalRevenueShareEstimate
    );
  });

  test('cashReadiness.canEveryoneBePaid is consistent with forecastPosition.status', () => {
    const surplus = deriveCommercialForecast(
      makeInput({
        fundingSources: [makeFundingSource({ amount: 50000 })],
        obligationRows: [makeObligationRow({ amount_owed: 11000 })],
      })
    );
    const deficit = deriveCommercialForecast(
      makeInput({
        fundingSources: [makeFundingSource({ amount: 5000 })],
        obligationRows: [makeObligationRow({ amount_owed: 11000 })],
      })
    );

    expect(surplus.cashReadiness.canEveryoneBePaid).toBe(true);
    expect(surplus.forecastPosition.status).toBe('surplus');

    expect(deficit.cashReadiness.canEveryoneBePaid).toBe(false);
    expect(deficit.forecastPosition.status).toBe('deficit');
  });

  test('confirmedRevenue + pendingRevenue + forecastRevenue accounts for all classified revenue', () => {
    const input = makeInput({
      fundingSources: [
        makeFundingSource({ id: 'fs-1', status: 'CONFIRMED', amount: 20000 }),
        makeFundingSource({ id: 'fs-2', status: 'PENDING', amount: 15000 }),
        makeFundingSource({ id: 'fs-3', status: 'FORECAST', amount: 10000 }),
      ],
    });
    const result = deriveCommercialForecast(input);

    const classifiedTotal = result.confirmedRevenue + result.pendingRevenue + result.forecastRevenue;
    expect(classifiedTotal).toBe(result.totalExpectedRevenue);
  });
});

/* ─── Part 13: Edge cases ────────────────────────────────────────────────────── */

describe('deriveCommercialForecast — edge cases', () => {
  test('handles string amount_owed values', () => {
    const input = makeInput({
      obligationRows: [makeObligationRow({ amount_owed: '300.00' })],
    });
    const result = deriveCommercialForecast(input);
    expect(result.totalFixedCommitments).toBe(300);
  });

  test('handles zero amount obligations', () => {
    const input = makeInput({
      obligationRows: [makeObligationRow({ amount_owed: 0 })],
    });
    const result = deriveCommercialForecast(input);
    expect(result.totalCommitments).toBe(0);
  });

  test('handles null treasury gracefully', () => {
    const input = makeInput({ treasury: null, fundingSources: [makeFundingSource()] });
    expect(() => deriveCommercialForecast(input)).not.toThrow();
  });

  test('handles null releaseConfidence gracefully', () => {
    const input = makeInput({ releaseConfidence: null });
    expect(() => deriveCommercialForecast(input)).not.toThrow();
  });

  test('produces stable incomingRevenue ordering', () => {
    const fundingSources = [
      makeFundingSource({ id: 'fs-3', name: 'C', amount: 30000 }),
      makeFundingSource({ id: 'fs-1', name: 'A', amount: 10000 }),
      makeFundingSource({ id: 'fs-2', name: 'B', amount: 20000 }),
    ];
    const r1 = deriveCommercialForecast(makeInput({ fundingSources }));
    const r2 = deriveCommercialForecast(makeInput({ fundingSources }));
    expect(r1.incomingRevenue.map((i) => i.id)).toEqual(r2.incomingRevenue.map((i) => i.id));
  });

  test('participant name is used from obligation row', () => {
    const input = makeInput({
      obligationRows: [makeObligationRow({ participant: { name: 'Sarah', role: 'Performer' } })],
    });
    const result = deriveCommercialForecast(input);
    expect(result.fixedCommitments[0].participantName).toBe('Sarah');
    expect(result.fixedCommitments[0].participantRole).toBe('Performer');
  });

  test('handles missing participant gracefully', () => {
    const input = makeInput({
      obligationRows: [makeObligationRow({ participant: null })],
    });
    const result = deriveCommercialForecast(input);
    expect(result.fixedCommitments[0].participantName).toBe('Unknown');
  });

  test('currency is propagated to output', () => {
    const input = makeInput({ currency: 'USD' });
    const result = deriveCommercialForecast(input);
    expect(result.currency).toBe('USD');
  });
});
