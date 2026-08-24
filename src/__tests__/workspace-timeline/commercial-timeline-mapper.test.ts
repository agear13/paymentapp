import {
  filterCommercialTimeline,
  groupCommercialTimeline,
  mapCommercialTimeline,
} from '@/lib/workspace-timeline/commercial-timeline-mapper';
import type { CommercialTimelineSources } from '@/lib/workspace-timeline/commercial-timeline-types';

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

function actions(result: ReturnType<typeof mapCommercialTimeline>) {
  return result.events.map((event) => event.action);
}

describe('mapCommercialTimeline', () => {
  test('payment created → paid → reconciled appears once each with real timestamps', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      paymentLinks: [
        {
          id: 'pl-1',
          organizationId: 'org-a',
          shortCode: 'AB12CD',
          status: 'PAID',
          amount: 4820,
          currency: 'AUD',
          description: 'Northline retainer',
          invoiceReference: 'INV-1042',
          xeroInvoiceNumber: 'INV-1042',
          customerName: 'Northline Group',
          paymentMethod: 'STRIPE',
          referralLinkId: null,
          createdAt: '2026-08-22T00:02:00.000Z',
        },
      ],
      paymentEvents: [
        {
          id: 'ev-created',
          organizationId: 'org-a',
          paymentLinkId: 'pl-1',
          eventType: 'CREATED',
          paymentMethod: 'STRIPE',
          amount: 4820,
          currency: 'AUD',
          receivedAt: null,
          createdAt: '2026-08-22T00:02:00.000Z',
        },
        {
          id: 'ev-init',
          organizationId: 'org-a',
          paymentLinkId: 'pl-1',
          eventType: 'PAYMENT_INITIATED',
          paymentMethod: 'STRIPE',
          amount: 4820,
          currency: 'AUD',
          receivedAt: null,
          createdAt: '2026-08-22T00:08:00.000Z',
        },
        {
          id: 'ev-paid',
          organizationId: 'org-a',
          paymentLinkId: 'pl-1',
          eventType: 'PAYMENT_CONFIRMED',
          paymentMethod: 'STRIPE',
          amount: 4820,
          currency: 'AUD',
          receivedAt: '2026-08-22T00:09:00.000Z',
          createdAt: '2026-08-22T00:09:05.000Z',
        },
      ],
      xeroSyncs: [
        {
          id: 'xs-pay',
          paymentLinkId: 'pl-1',
          syncType: 'PAYMENT',
          status: 'SUCCESS',
          createdAt: '2026-08-22T00:15:00.000Z',
          xeroInvoiceId: 'xero-inv',
          xeroPaymentId: 'xero-pay',
          errorMessage: null,
        },
      ],
    });

    expect(actions(result)).toEqual([
      'payment_reconciled',
      'payment_received',
      'payment_initiated',
      'invoice_created',
    ]);
    expect(result.events.filter((event) => event.action === 'payment_received')).toHaveLength(1);
    expect(result.events.find((event) => event.action === 'payment_received')).toMatchObject({
      occurredAt: '2026-08-22T00:09:00.000Z',
      amount: { amount: 4820, currency: 'AUD' },
      entityId: 'pl-1',
      href: '/workspace/invoice/INV-1042?id=pl-1',
    });
    expect(result.events.find((event) => event.action === 'invoice_created')?.id).toBe(
      'payment_event:ev-created'
    );
  });

  test('does not render the same payment received from Stripe, settlement, and Xero copies', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      paymentLinks: [
        {
          id: 'pl-1',
          organizationId: 'org-a',
          shortCode: 'AB12CD',
          status: 'PAID',
          amount: 4820,
          currency: 'AUD',
          description: 'Paid',
          invoiceReference: 'INV-1042',
          xeroInvoiceNumber: 'INV-1042',
          customerName: null,
          paymentMethod: 'STRIPE',
          referralLinkId: null,
          createdAt: '2026-08-22T00:02:00.000Z',
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
          receivedAt: '2026-08-22T00:09:00.000Z',
          createdAt: '2026-08-22T00:09:00.000Z',
        },
      ],
      xeroSyncs: [
        {
          id: 'xs-pay',
          paymentLinkId: 'pl-1',
          syncType: 'PAYMENT',
          status: 'SUCCESS',
          createdAt: '2026-08-22T00:15:00.000Z',
          xeroInvoiceId: null,
          xeroPaymentId: 'xp',
          errorMessage: null,
        },
      ],
    });

    expect(result.events.filter((event) => event.title === 'Payment received')).toHaveLength(1);
    expect(result.events.filter((event) => event.action === 'payment_reconciled')).toHaveLength(1);
  });

  test('does not fabricate invoice created twice when a CREATED payment event exists', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      paymentLinks: [
        {
          id: 'pl-1',
          organizationId: 'org-a',
          shortCode: 'ZZ',
          status: 'OPEN',
          amount: 100,
          currency: 'AUD',
          description: 'Draft',
          invoiceReference: null,
          xeroInvoiceNumber: null,
          customerName: null,
          paymentMethod: null,
          referralLinkId: null,
          createdAt: '2026-08-22T00:02:00.000Z',
        },
      ],
      paymentEvents: [
        {
          id: 'ev-created',
          organizationId: 'org-a',
          paymentLinkId: 'pl-1',
          eventType: 'CREATED',
          paymentMethod: null,
          amount: 100,
          currency: 'AUD',
          receivedAt: null,
          createdAt: '2026-08-22T00:02:00.000Z',
        },
      ],
    });

    expect(result.events.filter((event) => event.action === 'invoice_created')).toHaveLength(1);
  });

  test('ignores current-state payment status without a PAYMENT_CONFIRMED timestamp', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      paymentLinks: [
        {
          id: 'pl-1',
          organizationId: 'org-a',
          shortCode: 'ZZ',
          status: 'PAID',
          amount: 100,
          currency: 'AUD',
          description: 'Looks paid',
          invoiceReference: 'INV-1',
          xeroInvoiceNumber: null,
          customerName: null,
          paymentMethod: 'STRIPE',
          referralLinkId: null,
          createdAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    });

    expect(actions(result)).toEqual(['invoice_created']);
  });

  test('agreement uploaded → extracted uses only persisted timestamps and skips bootstrap internals', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      workflowAgreements: [
        {
          id: 'ag-1',
          organizationId: 'org-a',
          title: 'Master Services Agreement',
          originalFilename: 'msa.pdf',
          workflowSlug: 'agreement-intelligence',
          createdAt: '2026-08-20T01:00:00.000Z',
          extractedAt: '2026-08-20T01:10:00.000Z',
          approvedAt: null,
          bootstrappedAt: '2026-08-20T01:20:00.000Z',
        },
      ],
    });

    expect(actions(result)).toEqual(['agreement_extracted', 'agreement_uploaded']);
    expect(result.events.some((event) => event.action === 'obligations_generated')).toBe(false);
    expect(result.events.find((event) => event.action === 'agreement_extracted')).toMatchObject({
      occurredAt: '2026-08-20T01:10:00.000Z',
      href: '/workspace/workflows/agreement-intelligence/ag-1',
    });
  });

  test('does not invent agreement extracted from current READY status without extracted_at', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      workflowAgreements: [
        {
          id: 'ag-1',
          organizationId: 'org-a',
          title: 'MSA',
          originalFilename: null,
          workflowSlug: 'agreement-intelligence',
          createdAt: '2026-08-20T01:00:00.000Z',
          extractedAt: null,
          approvedAt: null,
          bootstrappedAt: null,
        },
      ],
    });

    expect(actions(result)).toEqual(['agreement_uploaded']);
  });

  test('referral → commission → obligation → released → paid', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      organizationDealIds: ['rmwf-1'],
      workflows: [
        {
          id: 'wf-1',
          organizationId: 'org-a',
          templateSlug: 'referral-management',
          createdAt: '2026-08-10T00:00:00.000Z',
          deployedAt: '2026-08-10T00:00:00.000Z',
        },
      ],
      participants: [
        {
          id: 'lee',
          name: 'Lee',
          dealId: 'rmwf-1',
          createdAt: '2026-08-11T00:00:00.000Z',
        },
      ],
      referralLinks: [
        {
          id: 'rl-1',
          organizationId: 'org-a',
          code: 'LEE20',
          createdAt: '2026-08-11T00:05:00.000Z',
        },
      ],
      commissionItems: [
        {
          id: 'ci-1',
          amount: 800,
          currency: 'AUD',
          createdAt: '2026-08-12T00:00:00.000Z',
          paidAt: '2026-08-13T04:00:00.000Z',
          payoutId: 'po-1',
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
          dealId: 'rmwf-1',
          participantId: 'lee',
          participantName: 'Lee',
          amount: 800,
          currency: 'AUD',
          createdAt: '2026-08-12T00:01:00.000Z',
        },
      ],
      payoutBatches: [
        {
          id: 'pb-1',
          organizationId: 'org-a',
          currency: 'AUD',
          totalAmount: 800,
          createdAt: '2026-08-13T02:00:00.000Z',
          submittedAt: '2026-08-13T02:10:00.000Z',
        },
      ],
      payouts: [
        {
          id: 'po-1',
          organizationId: 'org-a',
          batchId: 'pb-1',
          userId: 'lee',
          participantName: 'Lee',
          currency: 'AUD',
          netAmount: 800,
          status: 'PAID',
          paidAt: '2026-08-13T04:00:00.000Z',
          failedReason: null,
          createdAt: '2026-08-13T02:00:00.000Z',
        },
      ],
    });

    expect(actions(result)).toEqual([
      'payout_paid',
      'release_submitted',
      'release_created',
      'obligation_created',
      'commission_earned',
      'referral_link_generated',
      'participant_added',
      'referral_workflow_created',
    ]);
    expect(result.events.filter((event) => event.action === 'payout_paid')).toHaveLength(1);
    expect(result.events.find((event) => event.action === 'payout_paid')).toMatchObject({
      id: 'payout:po-1:paid',
      title: 'Payout paid',
      amount: { amount: 800, currency: 'AUD' },
      participantName: 'Lee',
      href: '/workspace/settlement/releases',
    });
    expect(result.events.find((event) => event.action === 'release_submitted')?.title).toBe('Released');
    expect(result.events.find((event) => event.action === 'commission_earned')?.href).toBe(
      '/workspace/settlement/earnings?source=referral-management&participant=lee'
    );
    expect(result.events.find((event) => event.action === 'obligation_created')?.description).toContain(
      'owed to Lee'
    );
  });

  test('failed payout recovery does not emit paid and does not fabricate a failed timestamp', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      payoutBatches: [
        {
          id: 'pb-1',
          organizationId: 'org-a',
          currency: 'AUD',
          totalAmount: 800,
          createdAt: '2026-08-13T02:00:00.000Z',
          submittedAt: '2026-08-13T02:10:00.000Z',
        },
      ],
      payouts: [
        {
          id: 'po-fail',
          organizationId: 'org-a',
          batchId: 'pb-1',
          userId: 'lee',
          participantName: 'Lee',
          currency: 'AUD',
          netAmount: 800,
          status: 'FAILED',
          paidAt: null,
          failedReason: 'Hedera transfer rejected',
          createdAt: '2026-08-13T02:00:00.000Z',
        },
      ],
    });

    expect(result.events.some((event) => event.action === 'payout_paid')).toBe(false);
    expect(result.events.some((event) => event.action === 'payout_failed')).toBe(false);
    expect(actions(result)).toEqual(['release_submitted', 'release_created']);
  });

  test('new organisation with no records has no fabricated commercial activity', () => {
    const result = mapCommercialTimeline(emptySources());
    expect(result.events).toEqual([]);
    expect(result.hasCommercialActivity).toBe(false);
  });

  test('system provisioning can appear without looking like commercial activity', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      organizationCreatedAt: '2026-08-01T00:00:00.000Z',
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      action: 'workspace_provisioned',
      category: 'system',
    });
    expect(result.hasCommercialActivity).toBe(false);
  });

  test('does not emit current recommendations as historical events', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      organizationCreatedAt: '2026-08-01T00:00:00.000Z',
      xeroConnection: { id: 'xc-1', connectedAt: '2026-08-02T00:00:00.000Z' },
    });

    expect(result.events.some((event) => /recommended/i.test(event.title))).toBe(false);
    expect(result.events.map((event) => event.action)).toEqual([
      'xero_connected',
      'workspace_provisioned',
    ]);
  });

  test('strict organisation isolation — org B records never appear in org A', () => {
    const result = mapCommercialTimeline({
      ...emptySources('org-a'),
      organizationCreatedAt: '2026-08-01T00:00:00.000Z',
      paymentLinks: [
        {
          id: 'pl-b',
          organizationId: 'org-b',
          shortCode: 'BBBB',
          status: 'PAID',
          amount: 9999,
          currency: 'AUD',
          description: 'Other org',
          invoiceReference: 'INV-OTHER',
          xeroInvoiceNumber: null,
          customerName: 'Other Co',
          paymentMethod: 'STRIPE',
          referralLinkId: null,
          createdAt: '2026-08-22T00:00:00.000Z',
        },
      ],
      paymentEvents: [
        {
          id: 'ev-b',
          organizationId: 'org-b',
          paymentLinkId: 'pl-b',
          eventType: 'PAYMENT_CONFIRMED',
          paymentMethod: 'STRIPE',
          amount: 9999,
          currency: 'AUD',
          receivedAt: '2026-08-22T00:09:00.000Z',
          createdAt: '2026-08-22T00:09:00.000Z',
        },
      ],
      payoutBatches: [
        {
          id: 'pb-b',
          organizationId: 'org-b',
          currency: 'AUD',
          totalAmount: 100,
          createdAt: '2026-08-22T01:00:00.000Z',
          submittedAt: null,
        },
      ],
      workflowAgreements: [
        {
          id: 'ag-b',
          organizationId: 'org-b',
          title: 'Secret MSA',
          originalFilename: null,
          workflowSlug: 'agreement-intelligence',
          createdAt: '2026-08-20T00:00:00.000Z',
          extractedAt: '2026-08-20T00:10:00.000Z',
          approvedAt: null,
          bootstrappedAt: null,
        },
      ],
    });

    expect(result.events.every((event) => !JSON.stringify(event).includes('org-b'))).toBe(true);
    expect(result.events.every((event) => !String(event.entityId).includes('pl-b'))).toBe(true);
    expect(result.hasCommercialActivity).toBe(false);
    expect(result.events.map((event) => event.action)).toEqual(['workspace_provisioned']);
  });

  test('same user org A never sees org B participants or obligations', () => {
    const shared = {
      ...emptySources('org-a'),
      organizationDealIds: ['deal-a'],
      participants: [
        { id: 'lee', name: 'Lee', dealId: 'deal-a', createdAt: '2026-08-11T00:00:00.000Z' },
        { id: 'jordan', name: 'Jordan', dealId: 'deal-b', createdAt: '2026-08-11T00:00:00.000Z' },
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
          createdAt: '2026-08-12T00:00:00.000Z',
        },
        {
          id: 'ob-b',
          organizationId: 'org-b',
          dealId: 'deal-b',
          participantId: 'jordan',
          participantName: 'Jordan',
          amount: 250,
          currency: 'AUD',
          createdAt: '2026-08-12T00:00:00.000Z',
        },
        {
          id: 'ob-legacy',
          organizationId: null,
          dealId: 'unknown-deal',
          participantId: 'mystery',
          participantName: 'Mystery',
          amount: 99,
          currency: 'AUD',
          createdAt: '2026-08-12T00:00:00.000Z',
        },
      ],
    };

    const orgA = mapCommercialTimeline(shared);
    expect(orgA.events.some((event) => event.participantName === 'Jordan')).toBe(false);
    expect(orgA.events.some((event) => event.entityId === 'ob-b')).toBe(false);
    expect(orgA.events.some((event) => event.entityId === 'ob-legacy')).toBe(false);
    expect(orgA.events.some((event) => event.entityId === 'lee')).toBe(true);
    expect(orgA.events.some((event) => event.entityId === 'ob-a')).toBe(true);

    const orgB = mapCommercialTimeline({
      ...shared,
      organizationId: 'org-b',
      organizationDealIds: ['deal-b'],
    });
    expect(orgB.events.some((event) => event.participantName === 'Lee')).toBe(false);
    expect(orgB.events.some((event) => event.entityId === 'ob-a')).toBe(false);
    expect(orgB.events.some((event) => event.entityId === 'jordan')).toBe(true);
    expect(orgB.events.some((event) => event.entityId === 'ob-b')).toBe(true);
  });

  test('obligation linked through an org-owned payment deal remains visible', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      paymentLinks: [
        {
          id: 'pl-1',
          organizationId: 'org-a',
          shortCode: 'AA',
          status: 'OPEN',
          amount: 10,
          currency: 'AUD',
          description: 'Invoice',
          invoiceReference: 'INV-1',
          xeroInvoiceNumber: null,
          customerName: null,
          paymentMethod: null,
          referralLinkId: null,
          createdAt: '2026-08-22T00:00:00.000Z',
          pilotDealId: 'deal-linked',
        },
      ],
      participants: [
        { id: 'lee', name: 'Lee', dealId: 'deal-linked', createdAt: '2026-08-21T00:00:00.000Z' },
      ],
      pilotObligations: [
        {
          id: 'ob-linked',
          organizationId: null,
          dealId: 'deal-linked',
          participantId: 'lee',
          participantName: 'Lee',
          amount: 800,
          currency: 'AUD',
          createdAt: '2026-08-22T01:00:00.000Z',
        },
      ],
    });

    expect(result.events.some((event) => event.entityId === 'lee')).toBe(true);
    expect(result.events.some((event) => event.entityId === 'ob-linked')).toBe(true);
  });

  test('category filters use the same stream', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      paymentLinks: [
        {
          id: 'pl-1',
          organizationId: 'org-a',
          shortCode: 'AA',
          status: 'OPEN',
          amount: 10,
          currency: 'AUD',
          description: 'Invoice',
          invoiceReference: 'INV-1',
          xeroInvoiceNumber: null,
          customerName: 'Northline Group',
          paymentMethod: null,
          referralLinkId: null,
          createdAt: '2026-08-22T00:00:00.000Z',
        },
      ],
      organizationDealIds: ['d1'],
      participants: [
        { id: 'lee', name: 'Lee', dealId: 'd1', createdAt: '2026-08-21T00:00:00.000Z' },
      ],
    });

    expect(filterCommercialTimeline(result.events, { category: 'payment' })).toHaveLength(1);
    expect(filterCommercialTimeline(result.events, { category: 'referral' })).toHaveLength(1);
    expect(filterCommercialTimeline(result.events, { participantId: 'lee' })).toHaveLength(1);
    expect(filterCommercialTimeline(result.events, { relationshipName: 'Northline Group' })).toHaveLength(1);
  });

  test('groups events into Today / Yesterday / earlier', () => {
    const now = new Date(2026, 7, 22, 16, 0, 0);
    const result = mapCommercialTimeline({
      ...emptySources(),
      paymentLinks: [
        {
          id: 'pl-today',
          organizationId: 'org-a',
          shortCode: 'T1',
          status: 'OPEN',
          amount: 1,
          currency: 'AUD',
          description: 'Today',
          invoiceReference: 'INV-T',
          xeroInvoiceNumber: null,
          customerName: null,
          paymentMethod: null,
          referralLinkId: null,
          createdAt: new Date(2026, 7, 22, 3, 14, 0).toISOString(),
        },
        {
          id: 'pl-old',
          organizationId: 'org-a',
          shortCode: 'O1',
          status: 'OPEN',
          amount: 1,
          currency: 'AUD',
          description: 'Earlier',
          invoiceReference: 'INV-O',
          xeroInvoiceNumber: null,
          customerName: null,
          paymentMethod: null,
          referralLinkId: null,
          createdAt: new Date(2026, 7, 10, 3, 0, 0).toISOString(),
        },
      ],
    });

    const groups = groupCommercialTimeline(result.events, now);
    expect(groups[0]?.label).toBe('Today');
    expect(groups.some((group) => group.label !== 'Today')).toBe(true);
  });

  test('dense same-day commercial story keeps distinct facts and settlement language', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      organizationDealIds: ['rmwf-1'],
      workflowAgreements: [
        {
          id: 'ag-1',
          organizationId: 'org-a',
          title: 'Master Services Agreement',
          originalFilename: 'msa.pdf',
          workflowSlug: 'agreement-intelligence',
          createdAt: '2026-08-22T09:00:00.000Z',
          extractedAt: '2026-08-22T09:03:00.000Z',
          approvedAt: null,
          bootstrappedAt: '2026-08-22T09:04:00.000Z',
        },
      ],
      participants: [
        { id: 'lee', name: 'Lee', dealId: 'rmwf-1', createdAt: '2026-08-22T09:10:00.000Z' },
      ],
      referralLinks: [
        {
          id: 'rl-1',
          organizationId: 'org-a',
          code: 'LEE20',
          createdAt: '2026-08-22T09:15:00.000Z',
          participantId: 'lee',
          participantName: 'Lee',
        },
      ],
      paymentLinks: [
        {
          id: 'pl-1',
          organizationId: 'org-a',
          shortCode: 'AB12CD',
          status: 'PAID',
          amount: 4820,
          currency: 'AUD',
          description: 'Retainer',
          invoiceReference: 'INV-1042',
          xeroInvoiceNumber: 'INV-1042',
          customerName: 'Northline Group',
          paymentMethod: 'STRIPE',
          referralLinkId: 'rl-1',
          createdAt: '2026-08-22T10:00:00.000Z',
        },
      ],
      paymentEvents: [
        {
          id: 'ev-created',
          organizationId: 'org-a',
          paymentLinkId: 'pl-1',
          eventType: 'CREATED',
          paymentMethod: 'STRIPE',
          amount: 4820,
          currency: 'AUD',
          receivedAt: null,
          createdAt: '2026-08-22T10:00:00.000Z',
        },
        {
          id: 'ev-init',
          organizationId: 'org-a',
          paymentLinkId: 'pl-1',
          eventType: 'PAYMENT_INITIATED',
          paymentMethod: 'STRIPE',
          amount: 4820,
          currency: 'AUD',
          receivedAt: null,
          createdAt: '2026-08-22T10:05:00.000Z',
        },
        {
          id: 'ev-paid',
          organizationId: 'org-a',
          paymentLinkId: 'pl-1',
          eventType: 'PAYMENT_CONFIRMED',
          paymentMethod: 'STRIPE',
          amount: 4820,
          currency: 'AUD',
          receivedAt: '2026-08-22T10:06:00.000Z',
          createdAt: '2026-08-22T10:06:00.000Z',
        },
      ],
      commissionItems: [
        {
          id: 'ci-1',
          amount: 800,
          currency: 'AUD',
          createdAt: '2026-08-22T10:06:00.000Z',
          paidAt: '2026-08-22T14:05:00.000Z',
          payoutId: 'po-1',
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
          dealId: 'rmwf-1',
          participantId: 'lee',
          participantName: 'Lee',
          amount: 800,
          currency: 'AUD',
          createdAt: '2026-08-22T10:06:00.000Z',
        },
      ],
      xeroSyncs: [
        {
          id: 'xs-pay',
          paymentLinkId: 'pl-1',
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
          id: 'po-1',
          organizationId: 'org-a',
          batchId: 'pb-1',
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

    const byAction = Object.fromEntries(result.events.map((event) => [event.action, event]));

    expect(result.events.some((event) => event.action === 'obligations_generated')).toBe(false);
    expect(result.events.some((event) => /ready for payout/i.test(event.title))).toBe(false);
    expect(byAction.agreement_uploaded).toMatchObject({
      importance: 'primary',
      href: '/workspace/workflows/agreement-intelligence/ag-1',
    });
    expect(byAction.agreement_extracted.importance).toBe('supporting');
    expect(byAction.participant_added).toMatchObject({
      importance: 'supporting',
      href: '/workspace/workflows/referral-management?participant=lee',
    });
    expect(byAction.referral_link_generated).toMatchObject({
      importance: 'supporting',
      href: '/workspace/workflows/referral-management?participant=lee',
    });
    expect(byAction.invoice_created.href).toContain('/workspace/invoice/INV-1042');
    expect(byAction.payment_initiated.importance).toBe('supporting');
    expect(byAction.payment_received).toMatchObject({
      importance: 'primary',
      occurredAt: '2026-08-22T10:06:00.000Z',
    });
    expect(byAction.commission_earned).toMatchObject({
      title: 'Commission earned',
      importance: 'primary',
      href: '/workspace/settlement/earnings?source=referral-management&participant=lee',
    });
    expect(byAction.commission_earned.description).toMatch(/Lee/);
    expect(byAction.obligation_created).toMatchObject({
      title: 'Obligation created',
      href: '/workspace/settlement/obligations/ob-1',
    });
    expect(byAction.obligation_created.description).toMatch(/owed to Lee/);
    expect(byAction.payment_reconciled.title).toBe('Payment reconciled');
    expect(byAction.release_submitted).toMatchObject({
      title: 'Released',
      href: '/workspace/settlement/releases',
    });
    expect(byAction.payout_paid).toMatchObject({
      title: 'Payout paid',
      href: '/workspace/settlement/releases',
    });
    expect(result.events.filter((event) => event.action === 'payout_paid')).toHaveLength(1);
    expect(result.events.filter((event) => event.action === 'payment_received')).toHaveLength(1);

    for (const event of result.events) {
      expect(event.href ?? '').not.toContain('/dashboard/payouts');
      if (event.category === 'settlement' || event.action === 'commission_earned') {
        expect(event.href).toMatch(/^\/workspace\/settlement\//);
      }
    }
  });

  test('draft and submitted releases are not labelled Paid', () => {
    const result = mapCommercialTimeline({
      ...emptySources(),
      payoutBatches: [
        {
          id: 'pb-1',
          organizationId: 'org-a',
          currency: 'AUD',
          totalAmount: 800,
          createdAt: '2026-08-22T14:00:00.000Z',
          submittedAt: null,
        },
      ],
      payouts: [
        {
          id: 'po-draft',
          organizationId: 'org-a',
          batchId: 'pb-1',
          userId: 'lee',
          participantName: 'Lee',
          currency: 'AUD',
          netAmount: 800,
          status: 'DRAFT',
          paidAt: null,
          failedReason: null,
          createdAt: '2026-08-22T14:00:00.000Z',
        },
      ],
    });

    expect(actions(result)).toEqual(['release_created']);
    expect(result.events[0]?.title).toBe('Release created');
    expect(result.events[0]?.importance).toBe('supporting');
    expect(result.events.some((event) => /paid/i.test(event.title))).toBe(false);
  });
});
