import { interpretCommercialTimelineAccount } from '@/lib/workspace-timeline/commercial-timeline-account';
import {
  summarizeTimelineSourceCompleteness,
  takeBounded,
} from '@/lib/workspace-timeline/commercial-timeline-completeness';
import { mapCommercialTimeline } from '@/lib/workspace-timeline/commercial-timeline-mapper';
import { findRelatedTimelineEvents } from '@/lib/workspace-timeline/commercial-timeline-related';
import type { CommercialTimelineSources } from '@/lib/workspace-timeline/commercial-timeline-types';
import { TIMELINE_SOURCE_LIMIT } from '@/lib/workspace-timeline/commercial-timeline-types';

function emptySources(organizationId = 'org-a'): CommercialTimelineSources {
  return {
    organizationId,
    organizationCreatedAt: null,
    organizationDealIds: [],
    paymentLinks: [],
    paymentEvents: [],
    xeroConnection: null,
    xeroSyncs: [],
    workflowAgreements: [],
    workflows: [],
    participants: [],
    pilotObligations: [],
    payoutBatches: [],
    payouts: [],
    commissionItems: [],
    referralLinks: [],
    connectedSystems: [],
  };
}

describe('timestamp integrity', () => {
  test('epoch and missing timestamps do not become 1970 timeline rows', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      organizationCreatedAt: '1970-01-01T00:00:00.000Z',
      paymentLinks: [
        {
          id: 'pl-epoch',
          organizationId: 'org-a',
          shortCode: 'EP',
          status: 'OPEN',
          amount: 10,
          currency: 'AUD',
          description: 'Bad',
          invoiceReference: 'INV-E',
          xeroInvoiceNumber: null,
          customerName: null,
          paymentMethod: null,
          referralLinkId: null,
          createdAt: '1970-01-01T00:00:00.000Z',
        },
        {
          id: 'pl-missing',
          organizationId: 'org-a',
          shortCode: 'MS',
          status: 'OPEN',
          amount: 10,
          currency: 'AUD',
          description: 'Missing',
          invoiceReference: 'INV-M',
          xeroInvoiceNumber: null,
          customerName: null,
          paymentMethod: null,
          referralLinkId: null,
          createdAt: '',
        },
      ],
      paymentEvents: [
        {
          id: 'ev-bad',
          organizationId: 'org-a',
          paymentLinkId: 'pl-epoch',
          eventType: 'PAYMENT_CONFIRMED',
          paymentMethod: 'STRIPE',
          amount: 10,
          currency: 'AUD',
          receivedAt: '1970-01-01T00:00:00.000Z',
          createdAt: '1970-01-01T00:00:00.000Z',
        },
      ],
    });

    expect(result.events).toEqual([]);
    expect(JSON.stringify(result.events)).not.toContain('1970');
  });

  test('valid created_at is still used for invoice created', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      paymentLinks: [
        {
          id: 'pl-1',
          organizationId: 'org-a',
          shortCode: 'OK',
          status: 'OPEN',
          amount: 10,
          currency: 'AUD',
          description: 'Ok',
          invoiceReference: 'INV-1',
          xeroInvoiceNumber: null,
          customerName: null,
          paymentMethod: null,
          referralLinkId: null,
          createdAt: '2026-08-22T10:00:00.000Z',
        },
      ],
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.occurredAt).toBe('2026-08-22T10:00:00.000Z');
  });
});

describe('same-second narrative order', () => {
  test('10:06 cluster is received → earned → owed', () => {
    const at = '2026-08-22T10:06:00.000Z';
    const result = mapCommercialTimeline({
      ...emptySources(),
      organizationDealIds: ['deal-a'],
      paymentLinks: [
        {
          id: 'pl-1',
          organizationId: 'org-a',
          shortCode: 'AA',
          status: 'PAID',
          amount: 4820,
          currency: 'AUD',
          description: 'Retainer',
          invoiceReference: 'INV-1042',
          xeroInvoiceNumber: 'INV-1042',
          customerName: 'Northline Group',
          paymentMethod: 'STRIPE',
          referralLinkId: null,
          createdAt: '2026-08-22T10:00:00.000Z',
        },
      ],
      paymentEvents: [
        {
          id: 'ev-paid',
          organizationId: 'org-a',
          paymentLinkId: 'pl-1',
          eventType: 'PAYMENT_CONFIRMED',
          paymentMethod: 'STRIPE',
          amount: 4820,
          currency: 'AUD',
          receivedAt: at,
          createdAt: at,
        },
      ],
      commissionItems: [
        {
          id: 'ci-1',
          amount: 800,
          currency: 'AUD',
          createdAt: at,
          paidAt: null,
          payoutId: null,
          paymentLinkId: 'pl-1',
          participantId: 'lee',
          participantName: 'Lee',
          invoiceReference: 'INV-1042',
        },
      ],
      pilotObligations: [
        {
          id: 'ob-1',
          organizationId: 'org-a',
          dealId: 'deal-a',
          participantId: 'lee',
          participantName: 'Lee',
          amount: 800,
          currency: 'AUD',
          createdAt: at,
        },
      ],
    });

    const cluster = result.events.filter((event) => event.occurredAt === at);
    expect(cluster.map((event) => event.action)).toEqual([
      'payment_received',
      'commission_earned',
      'obligation_created',
    ]);
    expect(cluster).toHaveLength(3);
  });

  test('newer timestamps still win over narrative rank', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      paymentEvents: [
        {
          id: 'ev-paid',
          organizationId: 'org-a',
          paymentLinkId: null,
          eventType: 'PAYMENT_CONFIRMED',
          paymentMethod: 'STRIPE',
          amount: 10,
          currency: 'AUD',
          receivedAt: '2026-08-22T11:00:00.000Z',
          createdAt: '2026-08-22T11:00:00.000Z',
        },
        {
          id: 'ev-created',
          organizationId: 'org-a',
          paymentLinkId: null,
          eventType: 'CREATED',
          paymentMethod: null,
          amount: 10,
          currency: 'AUD',
          receivedAt: null,
          createdAt: '2026-08-22T10:00:00.000Z',
        },
      ],
    });

    expect(result.events.map((event) => event.action)).toEqual(['payment_received', 'invoice_created']);
  });
});

describe('currency labels', () => {
  test('does not guess AUD when currency is absent', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      paymentEvents: [
        {
          id: 'ev-1',
          organizationId: 'org-a',
          paymentLinkId: null,
          eventType: 'PAYMENT_CONFIRMED',
          paymentMethod: 'STRIPE',
          amount: 4820,
          currency: null,
          receivedAt: '2026-08-22T10:06:00.000Z',
          createdAt: '2026-08-22T10:06:00.000Z',
        },
      ],
    });

    expect(result.events[0]?.amount).toEqual({ amount: 4820 });
    expect(result.events[0]?.currency).toBeUndefined();
    expect(result.events[0]?.description).toMatch(/4,820/);
    expect(result.events[0]?.description).not.toMatch(/A\$/);
    expect(result.events[0]?.description).not.toMatch(/AUD/);
  });

  test('keeps a real source currency', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      paymentEvents: [
        {
          id: 'ev-1',
          organizationId: 'org-a',
          paymentLinkId: null,
          eventType: 'PAYMENT_CONFIRMED',
          paymentMethod: 'STRIPE',
          amount: 100,
          currency: 'USD',
          receivedAt: '2026-08-22T10:06:00.000Z',
          createdAt: '2026-08-22T10:06:00.000Z',
        },
      ],
    });

    expect(result.events[0]?.amount).toEqual({ amount: 100, currency: 'USD' });
    expect(result.events[0]?.description).toMatch(/\$100/);
  });
});

describe('truncation metadata', () => {
  test('complete stream reports no truncation', () => {
    const completeness = summarizeTimelineSourceCompleteness([
      { name: 'payment_links', fetched: 3, limit: TIMELINE_SOURCE_LIMIT },
      { name: 'participants', fetched: 1, limit: TIMELINE_SOURCE_LIMIT },
    ]);
    expect(completeness.complete).toBe(true);
    expect(completeness.truncatedSources).toEqual([]);
  });

  test('capped source is marked incomplete without claiming a total event count', () => {
    const completeness = summarizeTimelineSourceCompleteness([
      { name: 'payment_events', fetched: TIMELINE_SOURCE_LIMIT + 1, limit: TIMELINE_SOURCE_LIMIT },
    ]);
    expect(completeness.complete).toBe(false);
    expect(completeness.truncatedSources).toEqual(['payment_events']);
    expect(completeness.sourceLimit).toBe(TIMELINE_SOURCE_LIMIT);
  });

  test('takeBounded does not duplicate rows when retaining the visible page', () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({ id: `r-${index}` }));
    const first = takeBounded(rows, 3);
    expect(first.truncated).toBe(true);
    expect(first.rows.map((row) => row.id)).toEqual(['r-0', 'r-1', 'r-2']);
    expect(new Set(first.rows.map((row) => row.id)).size).toBe(3);
  });
});

describe('no organisation vs empty organisation', () => {
  test('no resolved organisation is a distinct account state', () => {
    expect(
      interpretCommercialTimelineAccount({
        status: 'no_organization',
        organizationId: null,
        hasCommercialActivity: false,
      })
    ).toBe('no_organization');
  });

  test('organisation with no commercial activity is empty, not missing', () => {
    expect(
      interpretCommercialTimelineAccount({
        status: 'ok',
        organizationId: 'org-a',
        hasCommercialActivity: false,
      })
    ).toBe('empty');
  });

  test('empty organisation mapper still does not invent commercial rows', () => {
    const result = mapCommercialTimeline(emptySources());
    expect(result.events).toEqual([]);
    expect(result.hasCommercialActivity).toBe(false);
  });
});

describe('org A vs org B scenario', () => {
  test('org A story stays isolated from org B people and money', () => {
    const at = '2026-08-22T10:06:00.000Z';
    const orgA = mapCommercialTimeline({
      ...emptySources('org-a'),
      organizationDealIds: ['deal-a'],
      workflowAgreements: [
        {
          id: 'ag-a',
          organizationId: 'org-a',
          title: 'Master Services Agreement',
          originalFilename: 'msa.pdf',
          workflowSlug: 'agreement-intelligence',
          createdAt: '2026-08-22T09:00:00.000Z',
          extractedAt: null,
          approvedAt: null,
          bootstrappedAt: null,
        },
      ],
      paymentLinks: [
        {
          id: 'pl-a',
          organizationId: 'org-a',
          shortCode: 'AA',
          status: 'PAID',
          amount: 4820,
          currency: 'AUD',
          description: 'Retainer',
          invoiceReference: 'INV-1042',
          xeroInvoiceNumber: 'INV-1042',
          customerName: 'Northline Group',
          paymentMethod: 'STRIPE',
          referralLinkId: null,
          createdAt: '2026-08-22T10:00:00.000Z',
        },
        {
          id: 'pl-b',
          organizationId: 'org-b',
          shortCode: 'BB',
          status: 'PAID',
          amount: 9999,
          currency: 'AUD',
          description: 'Other',
          invoiceReference: 'INV-B',
          xeroInvoiceNumber: null,
          customerName: 'Other Co',
          paymentMethod: 'STRIPE',
          referralLinkId: null,
          createdAt: '2026-08-22T10:00:00.000Z',
        },
      ],
      paymentEvents: [
        {
          id: 'ev-created',
          organizationId: 'org-a',
          paymentLinkId: 'pl-a',
          eventType: 'CREATED',
          paymentMethod: 'STRIPE',
          amount: 4820,
          currency: 'AUD',
          receivedAt: null,
          createdAt: '2026-08-22T10:00:00.000Z',
        },
        {
          id: 'ev-paid',
          organizationId: 'org-a',
          paymentLinkId: 'pl-a',
          eventType: 'PAYMENT_CONFIRMED',
          paymentMethod: 'STRIPE',
          amount: 4820,
          currency: 'AUD',
          receivedAt: at,
          createdAt: at,
        },
      ],
      commissionItems: [
        {
          id: 'ci-a',
          amount: 800,
          currency: 'AUD',
          createdAt: at,
          paidAt: null,
          payoutId: 'po-a',
          paymentLinkId: 'pl-a',
          participantId: 'lee',
          participantName: 'Lee',
          invoiceReference: 'INV-1042',
        },
      ],
      participants: [
        { id: 'lee', name: 'Lee', dealId: 'deal-a', createdAt: '2026-08-22T09:10:00.000Z' },
        { id: 'jordan', name: 'Jordan', dealId: 'deal-b', createdAt: '2026-08-22T09:10:00.000Z' },
      ],
      pilotObligations: [
        {
          id: 'ob-a',
          organizationId: 'org-a',
          dealId: 'deal-a',
          participantId: 'lee',
          participantName: 'Lee',
          amount: 800,
          currency: 'AUD',
          createdAt: at,
        },
        {
          id: 'ob-b',
          organizationId: 'org-b',
          dealId: 'deal-b',
          participantId: 'jordan',
          participantName: 'Jordan',
          amount: 250,
          currency: 'AUD',
          createdAt: at,
        },
      ],
      xeroSyncs: [
        {
          id: 'xs-a',
          paymentLinkId: 'pl-a',
          syncType: 'PAYMENT',
          status: 'SUCCESS',
          createdAt: '2026-08-22T10:15:00.000Z',
          xeroInvoiceId: 'xi',
          xeroPaymentId: 'xp',
          errorMessage: null,
        },
      ],
      payoutBatches: [
        {
          id: 'pb-a',
          organizationId: 'org-a',
          currency: 'AUD',
          totalAmount: 800,
          createdAt: '2026-08-22T14:00:00.000Z',
          submittedAt: '2026-08-22T14:00:00.000Z',
        },
      ],
      payouts: [
        {
          id: 'po-a',
          organizationId: 'org-a',
          batchId: 'pb-a',
          userId: 'lee',
          participantName: 'Lee',
          currency: 'AUD',
          netAmount: 800,
          status: 'PAID',
          paidAt: '2026-08-22T14:05:00.000Z',
          failedReason: null,
          createdAt: '2026-08-22T14:00:00.000Z',
        },
      ],
    });

    expect(orgA.events.map((event) => event.action)).toEqual([
      'payout_paid',
      'release_created',
      'release_submitted',
      'payment_reconciled',
      'payment_received',
      'commission_earned',
      'obligation_created',
      'invoice_created',
      'participant_added',
      'agreement_uploaded',
    ]);
    expect(orgA.events.some((event) => event.participantName === 'Jordan')).toBe(false);
    expect(orgA.events.some((event) => event.entityId === 'ob-b' || event.entityId === 'pl-b')).toBe(
      false
    );
    expect(orgA.events.every((event) => !String(event.href ?? '').includes('/dashboard/payouts'))).toBe(
      true
    );

    const payment = orgA.events.find((event) => event.action === 'payment_received');
    const related = findRelatedTimelineEvents(payment!, orgA.events);
    expect(JSON.stringify(related)).not.toContain('Jordan');
    expect(related.every((event) => event.entityId !== 'ob-b' && event.entityId !== 'pl-b')).toBe(true);
  });
});
