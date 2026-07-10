/**
 * Business Financial Snapshot — aggregation tests
 */

const {
  deriveCommercialFinancialSnapshot,
} = require('../../lib/commercial/commercial-financial-snapshot');
const { deriveBusinessFinancialSnapshot } = require('../../lib/commercial/business-financial-snapshot');

function makeFundingSource(amount: number, id: string) {
  return {
    id,
    projectId: 'proj',
    organizationId: null,
    name: `Invoice ${id}`,
    description: null,
    sourceType: 'REVENUE',
    amount,
    currency: 'AUD',
    status: 'CONFIRMED',
    confidenceLevel: 'HIGH',
    expectedSettlementDate: null,
    actualSettlementDate: null,
    linkedInvoiceId: id,
    linkedPaymentId: null,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function projectSnapshot(projectId: string, revenue: number, obligations: number) {
  return deriveCommercialFinancialSnapshot({
    projectId,
    dealId: projectId,
    fundingSources: revenue > 0 ? [makeFundingSource(revenue, `${projectId}-inv`)] : [],
    treasury: null,
    obligationRows:
      obligations > 0
        ? [
            {
              id: `${projectId}-obl`,
              deal_id: projectId,
              obligation_type: 'fixed_fee',
              status: 'PENDING',
              amount_owed: obligations,
              currency: 'AUD',
              participant: { name: 'Alex', role: 'Performer' },
            },
          ]
        : [],
    releaseConfidence: null,
    currency: 'AUD',
  });
}

function healthSnapshot(projectId: string, name: string, category: string, score = 70) {
  return {
    projectId,
    agreementName: name,
    score,
    category,
    categoryLabel: category,
    categoryReason: '',
    signals: {},
    weights: {},
    factors: [],
    improvesScore: [],
    reducesScore: [],
    trend: { delta: 0, direction: 'stable', label: 'Stable', contributingFactors: [], previousScore: null },
    agreementValue: 0,
    blockerCount: 0,
    releaseReadyCount: 0,
    recordedAt: new Date().toISOString(),
  };
}

describe('deriveBusinessFinancialSnapshot', () => {
  test('aggregates revenue and obligations across multiple projects', () => {
    const records = [
      { projectId: 'a', agreementName: 'Project A', snapshot: projectSnapshot('a', 15000, 10000) },
      { projectId: 'b', agreementName: 'Project B', snapshot: projectSnapshot('b', 25000, 18000) },
      { projectId: 'c', agreementName: 'Project C', snapshot: projectSnapshot('c', 0, 0) },
    ];

    const business = deriveBusinessFinancialSnapshot({
      projectRecords: records,
      healthSnapshots: [
        healthSnapshot('a', 'Project A', 'healthy', 85),
        healthSnapshot('b', 'Project B', 'healthy', 82),
        healthSnapshot('c', 'Project C', 'attention_required', 45),
      ],
      portfolio: {
        totalAgreements: 3,
        averageScore: 70,
        byCategory: {
          excellent: 0,
          healthy: 2,
          attention_required: 1,
          at_risk: 0,
          critical: 0,
        },
        categoryLabels: {},
        snapshots: [],
      },
    });

    expect(business).not.toBeNull();
    expect(business.commercial.forecast.totalExpectedRevenue).toBe(40000);
    expect(business.commercial.forecast.totalCommitments).toBe(28000);
    expect(business.activeProjects).toBe(3);
    expect(business.projectHealth.healthy).toBe(2);
    expect(business.projectHealth.attentionRequired).toBe(1);
    expect(business.commercial.projectId).toBeNull();
  });

  test('new empty project does not erase existing business totals', () => {
    const withEmpty = deriveBusinessFinancialSnapshot({
      projectRecords: [
        { projectId: 'a', agreementName: 'A', snapshot: projectSnapshot('a', 15000, 10000) },
        { projectId: 'c', agreementName: 'C', snapshot: projectSnapshot('c', 0, 0) },
      ],
      healthSnapshots: [healthSnapshot('a', 'A', 'healthy'), healthSnapshot('c', 'C', 'healthy')],
      portfolio: null,
    });

    expect(withEmpty?.commercial.forecast.totalExpectedRevenue).toBe(15000);
    expect(withEmpty?.commercial.forecast.totalCommitments).toBe(10000);
  });

  test('returns null when no projects exist', () => {
    const business = deriveBusinessFinancialSnapshot({
      projectRecords: [],
      healthSnapshots: [],
      portfolio: null,
    });
    expect(business).toBeNull();
  });
});
