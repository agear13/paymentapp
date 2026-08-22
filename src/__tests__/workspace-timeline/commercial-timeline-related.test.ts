import { filterCommercialTimeline, mapCommercialTimeline } from '@/lib/workspace-timeline/commercial-timeline-mapper';
import { findRelatedTimelineEvents } from '@/lib/workspace-timeline/commercial-timeline-related';
import type {
  CommercialTimelineEvent,
  CommercialTimelineSources,
} from '@/lib/workspace-timeline/commercial-timeline-types';

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

function paymentLink(input: {
  id: string;
  organizationId?: string;
  invoice: string;
  customerName?: string | null;
  createdAt: string;
  dealId?: string;
}) {
  return {
    id: input.id,
    organizationId: input.organizationId ?? 'org-a',
    shortCode: input.id.slice(-4).toUpperCase(),
    status: 'PAID',
    amount: 4820,
    currency: 'AUD',
    description: input.invoice,
    invoiceReference: input.invoice,
    xeroInvoiceNumber: input.invoice,
    customerName: input.customerName ?? 'Northline Group',
    paymentMethod: 'STRIPE',
    referralLinkId: null,
    createdAt: input.createdAt,
    pilotDealId: input.dealId ?? null,
  };
}

function paymentEvent(input: {
  id: string;
  paymentLinkId: string;
  eventType: 'CREATED' | 'PAYMENT_CONFIRMED';
  at: string;
  organizationId?: string;
}) {
  return {
    id: input.id,
    organizationId: input.organizationId ?? 'org-a',
    paymentLinkId: input.paymentLinkId,
    eventType: input.eventType,
    paymentMethod: 'STRIPE',
    amount: 4820,
    currency: 'AUD',
    receivedAt: input.eventType === 'PAYMENT_CONFIRMED' ? input.at : null,
    createdAt: input.at,
  };
}

function byAction(events: CommercialTimelineEvent[], action: string) {
  return events.find((event) => event.action === action);
}

function titles(events: CommercialTimelineEvent[]) {
  return events.map((event) => event.title);
}

function ids(events: CommercialTimelineEvent[]) {
  return events.map((event) => event.id);
}

describe('commercial timeline related activity', () => {
  test('scenario A — expanding Payment received stays on the persisted payment chain', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      organizationDealIds: ['deal-1042'],
      paymentLinks: [
        paymentLink({
          id: 'pl-1042',
          invoice: 'INV-1042',
          createdAt: '2026-08-22T10:00:00.000Z',
          dealId: 'deal-1042',
        }),
        paymentLink({
          id: 'pl-same-day',
          invoice: 'INV-9999',
          customerName: 'Other same-day customer',
          createdAt: '2026-08-22T10:01:00.000Z',
        }),
      ],
      paymentEvents: [
        paymentEvent({
          id: 'ev-1042-created',
          paymentLinkId: 'pl-1042',
          eventType: 'CREATED',
          at: '2026-08-22T10:00:00.000Z',
        }),
        paymentEvent({
          id: 'ev-1042-paid',
          paymentLinkId: 'pl-1042',
          eventType: 'PAYMENT_CONFIRMED',
          at: '2026-08-22T10:06:00.000Z',
        }),
        paymentEvent({
          id: 'ev-same-day',
          paymentLinkId: 'pl-same-day',
          eventType: 'PAYMENT_CONFIRMED',
          at: '2026-08-22T10:06:30.000Z',
        }),
      ],
      xeroSyncs: [
        {
          id: 'xs-1042',
          paymentLinkId: 'pl-1042',
          syncType: 'PAYMENT',
          status: 'SUCCESS',
          createdAt: '2026-08-22T10:15:00.000Z',
          xeroInvoiceId: 'xi',
          xeroPaymentId: 'xp',
          errorMessage: null,
        },
      ],
      participants: [
        { id: 'lee', name: 'Lee', dealId: 'deal-1042', createdAt: '2026-08-11T00:00:00.000Z' },
      ],
      commissionItems: [
        {
          id: 'ci-lee-1042',
          amount: 800,
          currency: 'AUD',
          createdAt: '2026-08-22T10:06:00.000Z',
          paidAt: null,
          payoutId: 'po-lee',
          paymentLinkId: 'pl-1042',
          participantId: 'lee',
          participantName: 'Lee',
          invoiceReference: 'INV-1042',
          commissionObligationId: 'co-lee',
        },
      ],
      pilotObligations: [
        {
          id: 'ob-lee',
          organizationId: 'org-a',
          dealId: 'deal-1042',
          participantId: 'lee',
          participantName: 'Lee',
          amount: 800,
          currency: 'AUD',
          createdAt: '2026-08-22T10:06:00.000Z',
          paymentEventId: 'ev-1042-paid',
          paymentLinkId: 'pl-1042',
        },
      ],
      payoutBatches: [
        {
          id: 'pb-1',
          organizationId: 'org-a',
          currency: 'AUD',
          totalAmount: 800,
          createdAt: '2026-08-22T14:00:00.000Z',
          submittedAt: '2026-08-22T14:00:00.000Z',
        },
      ],
      payouts: [
        {
          id: 'po-lee',
          organizationId: 'org-a',
          batchId: 'pb-1',
          userId: 'lee',
          participantId: 'lee',
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

    expect(result.events.filter((event) => event.action === 'payment_received')).toHaveLength(2);
    expect(result.events.filter((event) => event.action === 'commission_earned')).toHaveLength(1);
    expect(result.events.filter((event) => event.action === 'obligation_created')).toHaveLength(1);
    expect(result.events.filter((event) => event.action === 'payout_paid')).toHaveLength(1);

    const payment = result.events.find(
      (event) => event.action === 'payment_received' && event.paymentLinkId === 'pl-1042'
    );
    expect(payment).toMatchObject({
      paymentLinkId: 'pl-1042',
      paymentEventId: 'ev-1042-paid',
      dealId: 'deal-1042',
      title: 'Payment received',
    });

    const related = findRelatedTimelineEvents(payment!, result.events);
    expect(ids(related)).not.toContain(payment!.id);
    expect(new Set(ids(related)).size).toBe(related.length);
    expect(titles(related)).toEqual(expect.arrayContaining([
      'Invoice created',
      'Commission earned',
      'Obligation created',
      'Payment reconciled',
      'Payout paid',
    ]));
    expect(related.find((event) => event.action === 'commission_earned')?.title).toBe('Commission earned');
    expect(related.find((event) => event.action === 'obligation_created')?.title).toBe(
      'Obligation created'
    );
    expect(related.find((event) => event.action === 'payout_paid')?.title).toBe('Payout paid');
    expect(related.some((event) => event.paymentLinkId === 'pl-same-day')).toBe(false);
    expect(related.some((event) => /caused by|then created|resulted in/i.test(event.title))).toBe(
      false
    );
  });

  test('scenario A — payout is omitted from payment related activity without a persisted chain', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      paymentLinks: [
        paymentLink({ id: 'pl-1042', invoice: 'INV-1042', createdAt: '2026-08-22T10:00:00.000Z' }),
      ],
      paymentEvents: [
        paymentEvent({
          id: 'ev-1042-paid',
          paymentLinkId: 'pl-1042',
          eventType: 'PAYMENT_CONFIRMED',
          at: '2026-08-22T10:06:00.000Z',
        }),
      ],
      commissionItems: [
        {
          id: 'ci-lee',
          amount: 800,
          currency: 'AUD',
          createdAt: '2026-08-22T10:06:00.000Z',
          paidAt: null,
          payoutId: null,
          paymentLinkId: 'pl-1042',
          participantId: 'lee',
          participantName: 'Lee',
          invoiceReference: 'INV-1042',
        },
      ],
      payouts: [
        {
          id: 'po-unlinked',
          organizationId: 'org-a',
          batchId: 'pb-1',
          userId: 'lee',
          participantId: 'lee',
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

    const payment = byAction(result.events, 'payment_received');
    const related = findRelatedTimelineEvents(payment!, result.events);
    expect(related.some((event) => event.action === 'payout_paid')).toBe(false);
    expect(related.some((event) => event.action === 'commission_earned')).toBe(true);
  });

  test('scenario B — participant filter is id-based and only includes a persisted funding invoice', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      organizationDealIds: ['deal-1042'],
      paymentLinks: [
        paymentLink({
          id: 'pl-1042',
          invoice: 'INV-1042',
          createdAt: '2026-08-22T10:00:00.000Z',
          dealId: 'deal-1042',
        }),
        paymentLink({
          id: 'pl-other',
          invoice: 'INV-OTHER',
          customerName: 'Lee Holdings',
          createdAt: '2026-08-22T10:02:00.000Z',
        }),
      ],
      paymentEvents: [
        paymentEvent({
          id: 'ev-1042',
          paymentLinkId: 'pl-1042',
          eventType: 'PAYMENT_CONFIRMED',
          at: '2026-08-22T10:06:00.000Z',
        }),
        paymentEvent({
          id: 'ev-other',
          paymentLinkId: 'pl-other',
          eventType: 'PAYMENT_CONFIRMED',
          at: '2026-08-22T10:07:00.000Z',
        }),
      ],
      participants: [
        { id: 'lee', name: 'Lee', dealId: 'deal-1042', createdAt: '2026-08-11T00:00:00.000Z' },
      ],
      commissionItems: [
        {
          id: 'ci-lee',
          amount: 800,
          currency: 'AUD',
          createdAt: '2026-08-22T10:06:00.000Z',
          paidAt: null,
          payoutId: 'po-lee',
          paymentLinkId: 'pl-1042',
          participantId: 'lee',
          participantName: 'Lee',
          invoiceReference: 'INV-1042',
        },
      ],
      pilotObligations: [
        {
          id: 'ob-lee',
          organizationId: 'org-a',
          dealId: 'deal-1042',
          participantId: 'lee',
          participantName: 'Lee',
          amount: 800,
          currency: 'AUD',
          createdAt: '2026-08-22T10:06:00.000Z',
        },
      ],
      payouts: [
        {
          id: 'po-lee',
          organizationId: 'org-a',
          batchId: 'pb-1',
          userId: 'lee',
          participantId: 'lee',
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

    const filtered = filterCommercialTimeline(result.events, { participantId: 'lee' });
    expect(filtered.some((event) => event.action === 'participant_added' && event.participantId === 'lee')).toBe(
      true
    );
    expect(filtered.some((event) => event.action === 'commission_earned' && event.participantId === 'lee')).toBe(
      true
    );
    expect(filtered.some((event) => event.action === 'obligation_created' && event.participantId === 'lee')).toBe(
      true
    );
    expect(filtered.some((event) => event.action === 'payout_paid' && event.participantId === 'lee')).toBe(true);
    expect(
      filtered.some((event) => event.action === 'payment_received' && event.paymentLinkId === 'pl-1042')
    ).toBe(true);
    expect(filtered.some((event) => event.paymentLinkId === 'pl-other')).toBe(false);
    expect(filterCommercialTimeline(result.events, { entityQuery: 'Lee' }).some((event) => event.paymentLinkId === 'pl-other')).toBe(
      false
    );
    expect(
      filterCommercialTimeline(result.events, { relationshipName: 'Lee Holdings' }).some(
        (event) => event.paymentLinkId === 'pl-other'
      )
    ).toBe(true);
  });

  test('scenario C — agreement relates to an invoice only with a shared deal id', () => {
    const shared = mapCommercialTimeline({
      ...emptySources(),
      paymentLinks: [
        paymentLink({
          id: 'pl-1042',
          invoice: 'INV-1042',
          createdAt: '2026-08-22T10:00:00.000Z',
          dealId: 'deal-shared',
        }),
      ],
      paymentEvents: [
        paymentEvent({
          id: 'ev-1042',
          paymentLinkId: 'pl-1042',
          eventType: 'PAYMENT_CONFIRMED',
          at: '2026-08-22T10:06:00.000Z',
        }),
      ],
      workflowAgreements: [
        {
          id: 'ag-msa',
          organizationId: 'org-a',
          title: 'Master Services Agreement',
          originalFilename: 'msa.pdf',
          workflowSlug: 'agreement-intelligence',
          createdAt: '2026-08-20T00:00:00.000Z',
          extractedAt: null,
          approvedAt: null,
          bootstrappedAt: null,
          dealId: 'deal-shared',
        },
      ],
    });

    const agreement = byAction(shared.events, 'agreement_uploaded');
    const payment = byAction(shared.events, 'payment_received');
    expect(agreement?.dealId).toBe('deal-shared');
    expect(payment?.dealId).toBe('deal-shared');
    expect(ids(findRelatedTimelineEvents(agreement!, shared.events))).toContain(payment!.id);
    expect(ids(findRelatedTimelineEvents(payment!, shared.events))).toContain(agreement!.id);

    const separate = mapCommercialTimeline({
      ...emptySources(),
      paymentLinks: [
        paymentLink({
          id: 'pl-1042',
          invoice: 'INV-1042',
          createdAt: '2026-08-22T10:00:00.000Z',
          dealId: 'deal-invoice',
        }),
      ],
      paymentEvents: [
        paymentEvent({
          id: 'ev-1042',
          paymentLinkId: 'pl-1042',
          eventType: 'PAYMENT_CONFIRMED',
          at: '2026-08-22T10:06:00.000Z',
        }),
      ],
      workflowAgreements: [
        {
          id: 'ag-msa',
          organizationId: 'org-a',
          title: 'Master Services Agreement',
          originalFilename: 'msa.pdf',
          workflowSlug: 'agreement-intelligence',
          createdAt: '2026-08-20T00:00:00.000Z',
          extractedAt: null,
          approvedAt: null,
          bootstrappedAt: null,
        },
      ],
    });

    const looseAgreement = byAction(separate.events, 'agreement_uploaded');
    const loosePayment = byAction(separate.events, 'payment_received');
    expect(looseAgreement?.dealId).toBeUndefined();
    expect(ids(findRelatedTimelineEvents(looseAgreement!, separate.events))).not.toContain(
      loosePayment!.id
    );
    expect(ids(findRelatedTimelineEvents(loosePayment!, separate.events))).not.toContain(
      looseAgreement!.id
    );
  });

  test('scenario D — a mixed batch does not become one payment story', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      paymentLinks: [
        paymentLink({
          id: 'pl-1042',
          invoice: 'INV-1042',
          createdAt: '2026-08-22T10:00:00.000Z',
        }),
        paymentLink({
          id: 'pl-2048',
          invoice: 'INV-2048',
          customerName: 'Other Co',
          createdAt: '2026-08-22T10:01:00.000Z',
        }),
      ],
      paymentEvents: [
        paymentEvent({
          id: 'ev-1042',
          paymentLinkId: 'pl-1042',
          eventType: 'PAYMENT_CONFIRMED',
          at: '2026-08-22T10:06:00.000Z',
        }),
        paymentEvent({
          id: 'ev-2048',
          paymentLinkId: 'pl-2048',
          eventType: 'PAYMENT_CONFIRMED',
          at: '2026-08-22T10:07:00.000Z',
        }),
      ],
      participants: [
        { id: 'lee', name: 'Lee', dealId: 'deal-1042', createdAt: '2026-08-11T00:00:00.000Z' },
        { id: 'mina', name: 'Mina', dealId: 'deal-2048', createdAt: '2026-08-11T00:00:00.000Z' },
      ],
      commissionItems: [
        {
          id: 'ci-lee',
          amount: 800,
          currency: 'AUD',
          createdAt: '2026-08-22T10:06:00.000Z',
          paidAt: null,
          payoutId: 'po-lee',
          paymentLinkId: 'pl-1042',
          participantId: 'lee',
          participantName: 'Lee',
          invoiceReference: 'INV-1042',
        },
        {
          id: 'ci-mina',
          amount: 250,
          currency: 'AUD',
          createdAt: '2026-08-22T10:07:00.000Z',
          paidAt: null,
          payoutId: 'po-mina',
          paymentLinkId: 'pl-2048',
          participantId: 'mina',
          participantName: 'Mina',
          invoiceReference: 'INV-2048',
        },
      ],
      payoutBatches: [
        {
          id: 'pb-mixed',
          organizationId: 'org-a',
          currency: 'AUD',
          totalAmount: 1050,
          createdAt: '2026-08-22T14:00:00.000Z',
          submittedAt: '2026-08-22T14:00:00.000Z',
        },
      ],
      payouts: [
        {
          id: 'po-lee',
          organizationId: 'org-a',
          batchId: 'pb-mixed',
          userId: 'lee',
          participantId: 'lee',
          participantName: 'Lee',
          currency: 'AUD',
          netAmount: 800,
          status: 'PAID',
          paidAt: '2026-08-22T14:05:00.000Z',
          failedReason: null,
          createdAt: '2026-08-22T14:00:00.000Z',
        },
        {
          id: 'po-mina',
          organizationId: 'org-a',
          batchId: 'pb-mixed',
          userId: 'mina',
          participantId: 'mina',
          participantName: 'Mina',
          currency: 'AUD',
          netAmount: 250,
          status: 'PAID',
          paidAt: '2026-08-22T14:05:00.000Z',
          failedReason: null,
          createdAt: '2026-08-22T14:00:00.000Z',
        },
      ],
    });

    const batch = result.events.find((event) => event.action === 'release_created');
    const leePayout = result.events.find((event) => event.payoutId === 'po-lee' && event.action === 'payout_paid');
    const minaPayout = result.events.find((event) => event.payoutId === 'po-mina' && event.action === 'payout_paid');
    const inv1042 = result.events.find(
      (event) => event.action === 'payment_received' && event.paymentLinkId === 'pl-1042'
    );
    const inv2048 = result.events.find(
      (event) => event.action === 'payment_received' && event.paymentLinkId === 'pl-2048'
    );

    const batchRelated = findRelatedTimelineEvents(batch!, result.events);
    expect(batchRelated.some((event) => event.payoutId === 'po-lee')).toBe(true);
    expect(batchRelated.some((event) => event.payoutId === 'po-mina')).toBe(true);
    expect(batchRelated.some((event) => event.action === 'payment_received')).toBe(false);
    expect(batchRelated.some((event) => event.action === 'invoice_created')).toBe(false);
    expect(batchRelated.some((event) => event.action === 'commission_earned')).toBe(false);

    const leeRelated = findRelatedTimelineEvents(leePayout!, result.events);
    expect(leeRelated.some((event) => event.id === inv1042!.id)).toBe(true);
    expect(leeRelated.some((event) => event.id === inv2048!.id)).toBe(false);
    expect(leeRelated.some((event) => event.payoutId === 'po-mina')).toBe(false);

    const minaRelated = findRelatedTimelineEvents(minaPayout!, result.events);
    expect(minaRelated.some((event) => event.id === inv2048!.id)).toBe(true);
    expect(minaRelated.some((event) => event.id === inv1042!.id)).toBe(false);
    expect(minaRelated.some((event) => event.payoutId === 'po-lee')).toBe(false);
  });

  test('scenario E — related activity cannot surface org B events while viewing org A', () => {
    const orgA = mapCommercialTimeline({
      ...emptySources('org-a'),
      organizationDealIds: ['deal-a'],
      paymentLinks: [
        paymentLink({
          id: 'pl-a',
          invoice: 'INV-1042',
          createdAt: '2026-08-22T10:00:00.000Z',
          dealId: 'deal-a',
        }),
        paymentLink({
          id: 'pl-b',
          organizationId: 'org-b',
          invoice: 'INV-B',
          customerName: 'Other Co',
          createdAt: '2026-08-22T10:00:00.000Z',
          dealId: 'deal-b',
        }),
      ],
      paymentEvents: [
        paymentEvent({
          id: 'ev-a',
          paymentLinkId: 'pl-a',
          eventType: 'PAYMENT_CONFIRMED',
          at: '2026-08-22T10:06:00.000Z',
        }),
        paymentEvent({
          id: 'ev-b',
          organizationId: 'org-b',
          paymentLinkId: 'pl-b',
          eventType: 'PAYMENT_CONFIRMED',
          at: '2026-08-22T10:06:00.000Z',
        }),
      ],
      participants: [
        { id: 'lee', name: 'Lee', dealId: 'deal-a', createdAt: '2026-08-11T00:00:00.000Z' },
        { id: 'jordan', name: 'Jordan', dealId: 'deal-b', createdAt: '2026-08-11T00:00:00.000Z' },
      ],
      commissionItems: [
        {
          id: 'ci-a',
          amount: 800,
          currency: 'AUD',
          createdAt: '2026-08-22T10:06:00.000Z',
          paidAt: null,
          payoutId: 'po-a',
          paymentLinkId: 'pl-a',
          participantId: 'lee',
          participantName: 'Lee',
          invoiceReference: 'INV-1042',
        },
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
          createdAt: '2026-08-22T10:06:00.000Z',
        },
        {
          id: 'ob-b',
          organizationId: 'org-b',
          dealId: 'deal-b',
          participantId: 'jordan',
          participantName: 'Jordan',
          amount: 250,
          currency: 'AUD',
          createdAt: '2026-08-22T10:06:00.000Z',
        },
      ],
    });

    expect(orgA.events.some((event) => event.entityId === 'pl-b' || event.entityId === 'ob-b')).toBe(
      false
    );
    expect(orgA.events.some((event) => event.participantName === 'Jordan')).toBe(false);

    const payment = byAction(orgA.events, 'payment_received');
    const related = findRelatedTimelineEvents(payment!, orgA.events);
    const serialized = JSON.stringify(related);
    expect(serialized).not.toContain('pl-b');
    expect(serialized).not.toContain('ob-b');
    expect(serialized).not.toContain('Jordan');
    expect(serialized).not.toContain('org-b');
    expect(related.some((event) => event.participantId === 'jordan')).toBe(false);
  });
});
