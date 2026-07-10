/**
 * Scenario Commercial Snapshot — planning simulation tests
 */

const { commercialRolesToObligationRows } = require('../../lib/commercial/commercial-roles-to-obligation-rows');
const {
  deriveScenarioCommercialSnapshot,
  updateRoleBudgetInList,
  updateFundingSourceAmountInList,
} = require('../../lib/commercial/scenario-commercial-snapshot');

function makeFundingSource(amount: number, id = 'fs-1') {
  return {
    id,
    projectId: 'proj-a',
    organizationId: null,
    name: 'Ticket sales',
    description: null,
    sourceType: 'ticketing',
    amount,
    currency: 'AUD',
    status: 'forecast',
    confidenceLevel: 'medium',
    expectedSettlementDate: null,
    actualSettlementDate: null,
    linkedInvoiceId: null,
    linkedPaymentId: null,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeRole(id: string, title: string, budgetType: string, budgetValue: number) {
  return {
    id,
    title,
    budgetType,
    budgetValue,
    status: 'PLANNED',
    participantId: null,
  };
}

function baseInput() {
  return {
    projectId: 'proj-a',
    dealId: 'proj-a',
    currency: 'AUD',
    commercialRoles: [
      makeRole('dj', 'DJ', 'FIXED', 500),
      makeRole('promoter', 'Promoter', 'REVENUE_SHARE', 15),
    ],
    fundingSources: [makeFundingSource(10000)],
  };
}

describe('commercialRolesToObligationRows', () => {
  test('maps fixed roles to obligation amounts', () => {
    const rows = commercialRolesToObligationRows(
      [makeRole('dj', 'DJ', 'FIXED', 500)],
      10000,
      'proj-a',
      'AUD'
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].amount_owed).toBe(500);
    expect(rows[0].status).toBe('PLANNED');
  });

  test('estimates revenue share from expected revenue', () => {
    const rows = commercialRolesToObligationRows(
      [makeRole('promoter', 'Promoter', 'REVENUE_SHARE', 20)],
      10000,
      'proj-a',
      'AUD'
    );
    expect(rows[0].amount_owed).toBe(2000);
  });
});

describe('deriveScenarioCommercialSnapshot', () => {
  test('is not dirty when baseline matches scenario', () => {
    const input = baseInput();
    const result = deriveScenarioCommercialSnapshot(input, { ...input });
    expect(result.dirty).toBe(false);
    expect(result.diff).toHaveLength(0);
  });

  test('recalculates forecast surplus when DJ budget increases', () => {
    const baseline = baseInput();
    const scenario = {
      ...baseline,
      commercialRoles: updateRoleBudgetInList(baseline.commercialRoles, 'dj', 800),
    };
    const result = deriveScenarioCommercialSnapshot(baseline, scenario);
    expect(result.dirty).toBe(true);
    const surplusDelta =
      result.scenario.forecast.forecastPosition.forecastSurplus -
      result.baseline.forecast.forecastPosition.forecastSurplus;
    expect(surplusDelta).toBe(-300);
    expect(result.diff.some((d: { id: string }) => d.id === 'role-dj')).toBe(true);
    expect(result.insights.length).toBeGreaterThan(0);
  });

  test('recalculates when ticket revenue decreases', () => {
    const baseline = baseInput();
    const scenario = {
      ...baseline,
      fundingSources: updateFundingSourceAmountInList(baseline.fundingSources, 'fs-1', 8000),
    };
    const result = deriveScenarioCommercialSnapshot(baseline, scenario);
    expect(result.dirty).toBe(true);
    expect(result.diff.some((d: { id: string }) => d.id === 'revenue-total')).toBe(true);
    expect(result.scenario.forecast.forecastPosition.totalExpectedRevenue).toBe(8000);
  });

  test('recalculates when promoter share increases', () => {
    const baseline = baseInput();
    const scenario = {
      ...baseline,
      commercialRoles: updateRoleBudgetInList(baseline.commercialRoles, 'promoter', 20),
    };
    const result = deriveScenarioCommercialSnapshot(baseline, scenario);
    const surplusDelta =
      result.scenario.forecast.forecastPosition.forecastSurplus -
      result.baseline.forecast.forecastPosition.forecastSurplus;
    expect(surplusDelta).toBeLessThan(0);
  });
});
