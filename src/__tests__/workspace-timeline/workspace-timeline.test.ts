/**
 * Workspace Timeline — regression tests
 */

const { deriveWorkspaceTimeline } = require('../../lib/workspace-timeline/workspace-timeline-service');
const { filterTimelineEvents } = require('../../lib/workspace-timeline/timeline-filters');
const { DEFAULT_TIMELINE_FILTERS } = require('../../lib/workspace-timeline/types');

describe('deriveWorkspaceTimeline', () => {
  test('creates invoice due event with commercial layer', () => {
    const result = deriveWorkspaceTimeline({
      deals: [{ id: 'proj-1', dealName: 'Beach Festival' }],
      participants: [],
      paymentLinks: [
        {
          id: 'pl-1',
          shortCode: 'PL2482',
          status: 'OPEN',
          amount: 5000,
          currency: 'AUD',
          description: 'Sponsor Payment',
          invoiceReference: 'INV-203',
          customerName: 'Rabbit Hole Festival',
          dueDate: '2026-06-03',
          invoiceDate: '2026-05-18',
          createdAt: '2026-05-18T00:00:00.000Z',
          pilotDealId: 'proj-1',
        },
      ],
      obligations: [],
      fundingSources: [],
      business: null,
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe('invoice_due');
    expect(result.events[0].layer).toBe('commercial');
    expect(result.events[0].entityKey).toBe('payment_link:pl-1');
    expect(result.events[0].lineage.length).toBeGreaterThan(2);
  });

  test('single payment link evolves — not duplicated for paid status', () => {
    const result = deriveWorkspaceTimeline({
      deals: [],
      participants: [],
      paymentLinks: [
        {
          id: 'pl-1',
          shortCode: 'x',
          status: 'PAID',
          amount: 1000,
          currency: 'AUD',
          description: 'Paid invoice',
          invoiceReference: null,
          customerName: null,
          dueDate: '2026-06-01',
          paidAt: '2026-06-02',
          createdAt: '2026-05-01',
          paymentMethod: 'STRIPE',
        },
      ],
      obligations: [],
      fundingSources: [],
      business: null,
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe('stripe_payment');
    expect(result.events[0].id).toBe('payment_link:pl-1');
  });

  test('filters by commercial layer', () => {
    const result = deriveWorkspaceTimeline({
      deals: [{ id: 'p', dealName: 'P', commercialRoles: [{ id: 'r1', title: 'DJ', budgetType: 'FIXED', budgetValue: 500, status: 'PLANNED' }] }],
      participants: [],
      paymentLinks: [
        {
          id: 'pl',
          shortCode: 'x',
          status: 'OPEN',
          amount: 100,
          currency: 'AUD',
          description: 'Rev',
          invoiceReference: null,
          customerName: null,
          dueDate: '2026-06-01',
          createdAt: '2026-05-01',
          pilotDealId: 'p',
        },
      ],
      obligations: [],
      fundingSources: [],
      business: null,
    });

    const commercialOnly = filterTimelineEvents(result.events, {
      ...DEFAULT_TIMELINE_FILTERS,
      layer: 'commercial',
    });
    expect(commercialOnly.every((e) => e.layer === 'commercial')).toBe(true);
    expect(commercialOnly.length).toBeGreaterThan(0);
  });

  test('month summary uses business snapshot when available', () => {
    const result = deriveWorkspaceTimeline(
      {
        deals: [{ id: 'p', dealName: 'P' }],
        participants: [],
        paymentLinks: [],
        obligations: [],
        fundingSources: [],
        business: {
          commercial: {
            forecast: {
              totalExpectedRevenue: 24000,
              confirmedRevenue: 12000,
              totalCommitments: 16000,
              forecastPosition: { forecastSurplus: 8000, forecastBalance: 8000, status: 'surplus' },
            },
            currency: 'AUD',
          },
          currency: 'AUD',
          activeProjects: 5,
          projectHealth: { healthy: 3, attentionRequired: 1, atRisk: 1, blocked: 0, total: 5 },
          cashReadiness: { readyCount: 3, notReadyCount: 2, totalCount: 5, requiresFundingCount: 1 },
          projectRecords: [],
          priorities: [],
          completedProjects: 0,
        },
      },
      new Date('2026-06-15')
    );

    expect(result.monthSummary.incomingExpected).toBe(24000);
    expect(result.monthSummary.incomingConfirmed).toBe(12000);
    expect(result.monthSummary.forecastSurplus).toBe(8000);
    expect(result.monthSummary.projectsAtRisk).toBe(1);
  });
});
