/**
 * Calendar event derivation — regression tests
 */

const { deriveCalendarEvents } = require('../../lib/calendar/derive-calendar-events');
const { filterCalendarEvents, deriveCalendarMonthSummary } = require('../../lib/calendar/calendar-utils');
const { DEFAULT_CALENDAR_FILTERS } = require('../../lib/calendar/types');

describe('deriveCalendarEvents', () => {
  test('creates expected revenue event from payment link due date', () => {
    const events = deriveCalendarEvents({
      deals: [{ id: 'proj-1', dealName: 'Beach Festival' }],
      participants: [],
      paymentLinks: [
        {
          id: 'pl-1',
          shortCode: 'abc123',
          status: 'OPEN',
          amount: 5000,
          currency: 'AUD',
          description: 'Sponsor Payment',
          invoiceReference: 'INV-203',
          customerName: 'Rabbit Hole Festival',
          dueDate: '2026-06-03',
          invoiceDate: '2026-05-18',
          expiresAt: null,
          createdAt: '2026-05-18T00:00:00.000Z',
          pilotDealId: 'proj-1',
        },
      ],
      obligations: [],
      fundingSources: [],
      tasks: [],
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('expected_revenue');
    expect(events[0].direction).toBe('incoming');
    expect(events[0].projectName).toBe('Beach Festival');
    expect(events[0].date).toBe('2026-06-03');
  });

  test('creates outgoing obligation event', () => {
    const events = deriveCalendarEvents({
      deals: [{ id: 'proj-1', dealName: 'Beach Festival' }],
      participants: [],
      paymentLinks: [],
      obligations: [
        {
          id: 'obl-1',
          deal_id: 'proj-1',
          obligation_type: 'fixed_fee',
          status: 'PENDING',
          amount_owed: 800,
          currency: 'AUD',
          due_date: '2026-06-03',
          participant: { name: 'DJ', role: 'Performer' },
        },
      ],
      fundingSources: [],
      tasks: [],
    });

    expect(events[0].type).toBe('money_outgoing');
    expect(events[0].amount).toBe(800);
    expect(events[0].title).toContain('DJ');
  });

  test('filters by project', () => {
    const events = deriveCalendarEvents({
      deals: [
        { id: 'a', dealName: 'A' },
        { id: 'b', dealName: 'B' },
      ],
      participants: [],
      paymentLinks: [
        {
          id: 'pl-a',
          shortCode: 'a',
          status: 'OPEN',
          amount: 100,
          currency: 'AUD',
          description: 'A invoice',
          invoiceReference: null,
          customerName: null,
          dueDate: '2026-06-01',
          invoiceDate: null,
          expiresAt: null,
          createdAt: '2026-05-01',
          pilotDealId: 'a',
        },
        {
          id: 'pl-b',
          shortCode: 'b',
          status: 'OPEN',
          amount: 200,
          currency: 'AUD',
          description: 'B invoice',
          invoiceReference: null,
          customerName: null,
          dueDate: '2026-06-02',
          invoiceDate: null,
          expiresAt: null,
          createdAt: '2026-05-01',
          pilotDealId: 'b',
        },
      ],
      obligations: [],
      fundingSources: [],
      tasks: [],
    });

    const filtered = filterCalendarEvents(events, {
      ...DEFAULT_CALENDAR_FILTERS,
      projectId: 'a',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].projectId).toBe('a');
  });

  test('summarises month incoming and outgoing', () => {
    const events = deriveCalendarEvents({
      deals: [{ id: 'p', dealName: 'P' }],
      participants: [],
      paymentLinks: [
        {
          id: 'pl',
          shortCode: 'x',
          status: 'OPEN',
          amount: 10000,
          currency: 'AUD',
          description: 'Revenue',
          invoiceReference: null,
          customerName: null,
          dueDate: '2026-06-10',
          invoiceDate: null,
          expiresAt: null,
          createdAt: '2026-05-01',
          pilotDealId: 'p',
        },
      ],
      obligations: [
        {
          id: 'o',
          deal_id: 'p',
          obligation_type: 'fixed_fee',
          status: 'PENDING',
          amount_owed: 3000,
          currency: 'AUD',
          due_date: '2026-06-15',
        },
      ],
      fundingSources: [],
      tasks: [],
    });

    const summary = deriveCalendarMonthSummary(events, new Date('2026-06-15'), 1);
    expect(summary.incoming).toBe(10000);
    expect(summary.outgoing).toBe(3000);
    expect(summary.net).toBe(7000);
  });
});
