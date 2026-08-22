import {
  attachEarningSettlementStatus,
  buildSettlementObligationRows,
  canCancelDraftReleaseBatch,
  classifyCommercialSource,
  classifyWorkspaceStatus,
  filterSettlementObligations,
  mapAttributionEarning,
  mapPayoutBatch,
  moneyLabel,
  parseSettlementObligationId,
  summarizeSettlement,
} from '@/lib/settlement/workspace-settlement';
import {
  settlementEarningsHref,
  settlementObligationsHref,
  settlementOverviewHref,
  settlementSectionHref,
  COMMERCIAL_OS_ROUTES,
} from '@/lib/journey/commercial-os-routes';
import {
  deriveReferralParticipantSettlementSummary,
  deriveReferralWorkflowSettlementSummary,
} from '@/lib/workflows/referral-management/settlement-summary';

describe('workspace settlement mapping', () => {
  it('classifies commercial sources from existing deal and type signals', () => {
    expect(classifyCommercialSource({ dealId: 'rmwf-abc' })).toBe('referral-management');
    expect(classifyCommercialSource({ kind: 'attribution' })).toBe('referral-management');
    expect(classifyCommercialSource({ obligationType: 'REVENUE_SHARE' })).toBe(
      'revenue-sharing'
    );
    expect(classifyCommercialSource({ obligationType: 'PARTICIPANT' })).toBe('agreements');
    expect(classifyCommercialSource({ obligationType: 'PLATFORM_FEE' })).toBe('other');
  });

  it('maps legacy obligation statuses into canonical money states', () => {
    expect(classifyWorkspaceStatus({ status: 'AVAILABLE_FOR_PAYOUT' })).toBe('ready');
    expect(classifyWorkspaceStatus({ status: 'PENDING_APPROVAL' })).toBe('requires_action');
    expect(classifyWorkspaceStatus({ status: 'UNFUNDED' })).toBe('requires_action');
    expect(classifyWorkspaceStatus({ status: 'APPROVED' })).toBe('pending');
    expect(classifyWorkspaceStatus({ status: 'PAID' })).toBe('paid');
    expect(classifyWorkspaceStatus({ status: 'SUBMITTED' })).toBe('released');
    expect(
      classifyWorkspaceStatus({ status: 'APPROVED', blockingIssue: 'Participant setup incomplete' })
    ).toBe('requires_action');
  });

  it('does not treat onboarding as ready for payout', () => {
    const rows = buildSettlementObligationRows(
      [
        {
          id: 'ob-1',
          deal_id: 'rmwf-1',
          obligation_type: 'PARTICIPANT',
          status: 'APPROVED',
          amount_owed: 800,
          currency: 'AUD',
          participant: {
            id: 'p1',
            name: 'Sarah',
            approvalStatus: 'Approved',
            onboardingStatus: 'COMPLETE',
          },
        },
      ],
      []
    );
    expect(rows[0]?.workspaceStatus).toBe('pending');
    expect(rows[0]?.workspaceStatusLabel).toBe('Pending');
  });

  it('builds a unified queue from pilot obligations and attribution earnings', () => {
    const rows = buildSettlementObligationRows(
      [
        {
          id: 'ob-1',
          deal_id: 'rmwf-1',
          obligation_type: 'PARTICIPANT',
          status: 'AVAILABLE_FOR_PAYOUT',
          amount_owed: 800,
          currency: 'AUD',
          deal: { id: 'rmwf-1', name: 'Referral Management' },
          participant: {
            id: 'p1',
            name: 'Sarah',
            approvalStatus: 'Approved',
            onboardingStatus: 'COMPLETE',
          },
        },
        {
          id: 'ob-2',
          deal_id: 'deal-agree',
          obligation_type: 'fixed_fee',
          status: 'PENDING_APPROVAL',
          amount_owed: 400,
          currency: 'AUD',
          deal: { id: 'deal-agree', name: 'Brand partnership' },
          participant: { id: 'p2', name: 'Alex', approvalStatus: 'Pending approval' },
        },
      ],
      [
        {
          participantId: 'p3',
          participantName: 'Jordan',
          dealId: 'rmwf-1',
          dealName: 'Referral Management',
          outstandingAmount: 250,
          paidAmount: 50,
          currency: 'AUD',
          items: [{ id: 'i1', amount: 250, currency: 'AUD', status: 'POSTED' }],
        },
      ]
    );

    expect(rows).toHaveLength(3);
    expect(rows[0]?.source).toBe('referral-management');
    expect(rows[0]?.workspaceStatus).toBe('ready');
    expect(rows[1]?.source).toBe('agreements');
    expect(rows[1]?.workspaceStatus).toBe('requires_action');
    expect(rows[2]?.workspaceStatus).toBe('pending');
    expect(rows[2]?.reason).toBeNull();
  });

  it('does not double-count attribution when the same participant already has a pilot obligation', () => {
    const rows = buildSettlementObligationRows(
      [
        {
          id: 'ob-1',
          deal_id: 'rmwf-1',
          obligation_type: 'PARTICIPANT',
          status: 'UNFUNDED',
          amount_owed: 300,
          currency: 'AUD',
          participant: { id: 'p1', name: 'Sarah' },
        },
      ],
      [
        {
          participantId: 'p1',
          participantName: 'Sarah',
          dealId: 'rmwf-1',
          dealName: 'Referral Management',
          outstandingAmount: 300,
          paidAmount: 0,
          currency: 'AUD',
          items: [],
        },
      ]
    );
    const summary = summarizeSettlement(rows);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe('pilot');
    expect(summary.owed).toBe(300);
    expect(summary.requiresAction).toBe(300);
    expect(summary.requiresActionParticipants).toBe(1);
    expect(summary.requiresActionCount).toBe(1);
  });

  it('keeps a synthetic obligation row when attribution has no underlying pilot obligation', () => {
    const rows = buildSettlementObligationRows(
      [],
      [
        {
          participantId: 'jordan',
          participantName: 'Jordan',
          dealId: 'rmwf-1',
          dealName: 'Referral Management',
          outstandingAmount: 250,
          paidAmount: 50,
          currency: 'AUD',
          items: [{ id: 'i1', amount: 300, currency: 'AUD', status: 'POSTED' }],
        },
      ]
    );
    const summary = summarizeSettlement(rows);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe('attribution');
    expect(rows[0]?.workspaceStatus).toBe('pending');
    expect(summary.owed).toBe(250);
    expect(summary.pending).toBe(250);
    expect(summary.pendingCount).toBe(1);
  });

  it('keeps attribution on Earnings after the linked obligation row is canonicalized', () => {
    const attribution = {
      participantId: 'p1',
      participantName: 'Sarah',
      dealId: 'rmwf-1',
      dealName: 'Referral Management',
      outstandingAmount: 300,
      paidAmount: 0,
      currency: 'AUD',
      items: [{ id: 'i1', amount: 300, currency: 'AUD', status: 'POSTED' }],
    };
    const obligations = buildSettlementObligationRows(
      [
        {
          id: 'ob-1',
          deal_id: 'rmwf-1',
          obligation_type: 'PARTICIPANT',
          status: 'APPROVED',
          amount_owed: 300,
          currency: 'AUD',
          participant: {
            id: 'p1',
            name: 'Sarah',
            approvalStatus: 'Approved',
            onboardingStatus: 'INCOMPLETE',
          },
        },
      ],
      [attribution]
    );
    const earnings = attachEarningSettlementStatus(
      [mapAttributionEarning(attribution)],
      obligations
    );
    expect(obligations).toHaveLength(1);
    expect(earnings).toHaveLength(1);
    expect(earnings[0]?.earned).toBe(300);
    expect(earnings[0]?.unpaid).toBe(300);
    expect(earnings[0]?.settlementStatus).toBe('requires_action');
  });

  it('makes obligation totals and queue counts agree after canonical identity', () => {
    const rows = buildSettlementObligationRows(
      [
        {
          id: 'ob-sarah',
          deal_id: 'rmwf-1',
          status: 'APPROVED',
          amount_owed: 300,
          currency: 'AUD',
          participant: { id: 'sarah', name: 'Sarah', onboardingStatus: 'INCOMPLETE' },
        },
        {
          id: 'ob-lee',
          deal_id: 'rmwf-1',
          status: 'AVAILABLE_FOR_PAYOUT',
          amount_owed: 800,
          currency: 'AUD',
          participant: { id: 'lee', name: 'Lee', onboardingStatus: 'COMPLETE' },
        },
      ],
      [
        {
          participantId: 'sarah',
          participantName: 'Sarah',
          dealId: 'rmwf-1',
          dealName: 'Referral Management',
          outstandingAmount: 300,
          paidAmount: 0,
          currency: 'AUD',
          items: [],
        },
        {
          participantId: 'jordan',
          participantName: 'Jordan',
          dealId: 'rmwf-1',
          dealName: 'Referral Management',
          outstandingAmount: 250,
          paidAmount: 50,
          currency: 'AUD',
          items: [],
        },
      ]
    );
    const summary = summarizeSettlement(rows);
    expect(rows).toHaveLength(3);
    expect(rows.filter((row) => row.participantId === 'sarah')).toHaveLength(1);
    expect(summary.pendingCount + summary.requiresActionCount + summary.readyCount).toBe(
      rows.filter((row) => ['pending', 'requires_action', 'ready'].includes(row.workspaceStatus))
        .length
    );
    expect(summary.pending + summary.requiresAction + summary.readyForPayout).toBe(summary.owed);
    expect(summary.owed).toBe(1350);
    expect(summary.pending).toBe(250);
    expect(summary.requiresAction).toBe(300);
    expect(summary.readyForPayout).toBe(800);
  });

  it('follows Ready → released/processing → Paid from payout receipts, not batch existence', () => {
    const readyPilot = {
      id: 'ob-lee',
      deal_id: 'rmwf-1',
      status: 'AVAILABLE_FOR_PAYOUT' as const,
      amount_owed: 800,
      currency: 'AUD',
      participant: { id: 'lee', name: 'Lee', onboardingStatus: 'COMPLETE' },
    };
    const ready = buildSettlementObligationRows([readyPilot], []);
    expect(ready[0]?.workspaceStatus).toBe('ready');
    expect(summarizeSettlement(ready).paid).toBe(0);

    const created = buildSettlementObligationRows([readyPilot], [], [
      { participantId: 'lee', status: 'DRAFT' },
    ]);
    expect(created[0]?.workspaceStatus).toBe('released');
    expect(created[0]?.workspaceStatusLabel).toBe('Released');
    expect(summarizeSettlement(created).paid).toBe(0);
    expect(summarizeSettlement(created).owed).toBe(0);
    expect(
      deriveReferralParticipantSettlementSummary(created, 800).status
    ).toBe('released');
    expect(
      attachEarningSettlementStatus(
        [
          mapAttributionEarning({
            participantId: 'lee',
            participantName: 'Lee',
            dealId: 'rmwf-1',
            dealName: 'Referral Management',
            outstandingAmount: 800,
            paidAmount: 0,
            currency: 'AUD',
            items: [],
          }),
        ],
        created
      )[0]?.settlementStatus
    ).toBe('released');

    const submitted = buildSettlementObligationRows([readyPilot], [], [
      { participantId: 'lee', status: 'SUBMITTED' },
    ]);
    expect(submitted[0]?.workspaceStatus).toBe('released');
    expect(summarizeSettlement(submitted).paid).toBe(0);

    const confirmed = buildSettlementObligationRows(
      [{ ...readyPilot, status: 'PAID' }],
      [],
      [{ participantId: 'lee', status: 'PAID' }]
    );
    expect(confirmed[0]?.workspaceStatus).toBe('paid');
    expect(summarizeSettlement(confirmed).paid).toBe(800);
    expect(deriveReferralParticipantSettlementSummary(confirmed, 800).status).toBe('paid');
  });

  it('does not mark every obligation Paid just because the batch exists', () => {
    const rows = buildSettlementObligationRows(
      [
        {
          id: 'ob-lee',
          deal_id: 'rmwf-1',
          status: 'AVAILABLE_FOR_PAYOUT',
          amount_owed: 800,
          currency: 'AUD',
          participant: { id: 'lee', name: 'Lee' },
        },
        {
          id: 'ob-mina',
          deal_id: 'rmwf-1',
          status: 'AVAILABLE_FOR_PAYOUT',
          amount_owed: 400,
          currency: 'AUD',
          participant: { id: 'mina', name: 'Mina' },
        },
      ],
      [],
      [
        { participantId: 'lee', status: 'PAID' },
        { participantId: 'mina', status: 'SUBMITTED' },
      ]
    );
    expect(rows.find((row) => row.participantId === 'lee')?.workspaceStatus).toBe('paid');
    expect(rows.find((row) => row.participantId === 'mina')?.workspaceStatus).toBe('released');
    expect(summarizeSettlement(rows).paid).toBe(800);
    expect(summarizeSettlement(rows).released).toBe(400);
  });

  it('filters the operator queue by source, status, and participant', () => {
    const rows = buildSettlementObligationRows(
      [
        {
          id: 'ob-1',
          deal_id: 'rmwf-1',
          status: 'AVAILABLE_FOR_PAYOUT',
          amount_owed: 100,
          participant: { id: 'p1', name: 'Sarah' },
        },
        {
          id: 'ob-2',
          deal_id: 'agree-1',
          obligation_type: 'fixed_fee',
          status: 'PAID',
          amount_owed: 50,
          participant: { id: 'p2', name: 'Alex' },
        },
      ],
      []
    );
    expect(
      filterSettlementObligations(rows, { source: 'referral-management' }).map((row) => row.id)
    ).toEqual(['ob-1']);
    expect(filterSettlementObligations(rows, { status: 'paid' }).map((row) => row.id)).toEqual([
      'ob-2',
    ]);
    expect(filterSettlementObligations(rows, { participant: 'p2' }).map((row) => row.id)).toEqual([
      'ob-2',
    ]);
  });

  it('attaches settlement status to earnings without calling unpaid Ready', () => {
    const obligations = buildSettlementObligationRows(
      [
        {
          id: 'ob-1',
          deal_id: 'rmwf-1',
          status: 'AVAILABLE_FOR_PAYOUT',
          amount_owed: 200,
          participant: { id: 'p1', name: 'Sarah' },
        },
      ],
      []
    );
    const earnings = attachEarningSettlementStatus(
      [
        mapAttributionEarning({
          participantId: 'p1',
          participantName: 'Sarah',
          dealId: 'rmwf-1',
          dealName: 'Referral Management',
          outstandingAmount: 200,
          paidAmount: 50,
          currency: 'AUD',
          items: [],
        }),
      ],
      obligations
    );
    expect(earnings[0]?.unpaid).toBe(200);
    expect(earnings[0]?.settlementStatus).toBe('ready');
    expect(earnings[0]?.settlementStatusLabel).toBe('Ready for payout');
  });

  it('does not map a completed batch to Paid without payout receipt', () => {
    const released = mapPayoutBatch({
      id: 'b1',
      currency: 'AUD',
      status: 'COMPLETED',
      payoutCount: 2,
      totalAmount: 500,
      createdAt: '2026-08-22T00:00:00.000Z',
      payouts: [{ id: 'p1', status: 'SUBMITTED' }],
    });
    expect(released.paymentState).toBe('released');
    expect(released.statusLabel).toBe('Released — processing');

    const paid = mapPayoutBatch({
      id: 'b2',
      currency: 'AUD',
      status: 'COMPLETED',
      payoutCount: 1,
      totalAmount: 200,
      createdAt: '2026-08-22T00:00:00.000Z',
      payouts: [{ id: 'p2', status: 'PAID' }],
    });
    expect(paid.paymentState).toBe('paid');
    expect(paid.statusLabel).toBe('Paid');
  });

  it('parses workspace obligation ids without inventing a new store', () => {
    expect(parseSettlementObligationId('attribution:p1')).toEqual({
      kind: 'attribution',
      sourceId: 'p1',
    });
    expect(parseSettlementObligationId('ob-9')).toEqual({ kind: 'pilot', sourceId: 'ob-9' });
  });
});

describe('settlement workspace hrefs', () => {
  it('keeps settlement scope across workspace sections', () => {
    expect(COMMERCIAL_OS_ROUTES.settlement).toBe('/workspace/settlement');
    expect(settlementOverviewHref({ source: 'referral-management' })).toBe(
      '/workspace/settlement?source=referral-management'
    );
    expect(settlementSectionHref('earnings', { source: 'referral-management', participant: 'p1' })).toBe(
      '/workspace/settlement/earnings?source=referral-management&participant=p1'
    );
    expect(settlementObligationsHref({ source: 'referral-management' })).toBe(
      '/workspace/settlement/obligations?source=referral-management'
    );
    expect(settlementEarningsHref({ participant: 'p1' })).toBe(
      '/workspace/settlement/earnings?participant=p1'
    );
  });
});

describe('referral management settlement snippets', () => {
  it('uses settlement-domain rows rather than payout setup', () => {
    const rows = buildSettlementObligationRows(
      [
        {
          id: 'ob-1',
          deal_id: 'rmwf-1',
          status: 'APPROVED',
          amount_owed: 1200,
          participant: {
            id: 'p1',
            name: 'Sarah',
            approvalStatus: 'Approved',
            onboardingStatus: 'COMPLETE',
          },
        },
      ],
      []
    );
    const summary = deriveReferralParticipantSettlementSummary(rows, 1200);
    expect(summary.earned).toBe(1200);
    expect(summary.status).toBe('pending');
    expect(summary.ready).toBe(0);
    expect(summary.statusLabel).toBe('Pending');
  });

  it('rolls up ready and requires action from mapped obligations', () => {
    const rows = buildSettlementObligationRows(
      [
        {
          id: 'ob-1',
          deal_id: 'rmwf-1',
          status: 'AVAILABLE_FOR_PAYOUT',
          amount_owed: 800,
          participant: { id: 'p1', name: 'Sarah', onboardingStatus: 'COMPLETE' },
        },
        {
          id: 'ob-2',
          deal_id: 'rmwf-1',
          status: 'UNFUNDED',
          amount_owed: 400,
          participant: { id: 'p2', name: 'Alex' },
        },
      ],
      []
    );
    const rollup = deriveReferralWorkflowSettlementSummary(rows, 1200);
    expect(rollup.earned).toBe(1200);
    expect(rollup.ready).toBe(800);
    expect(rollup.requiresAction).toBe(400);
    expect(rollup.owed).toBe(1200);
  });

  it('formats money without inventing a second calculator', () => {
    expect(moneyLabel(300, 'AUD')).toMatch(/300/);
  });
});

describe('settlement recovery transitions', () => {
  const leeReady = {
    id: 'ob-lee',
    deal_id: 'rmwf-1',
    status: 'AVAILABLE_FOR_PAYOUT' as const,
    amount_owed: 800,
    currency: 'AUD',
    participant: { id: 'lee', name: 'Lee', onboardingStatus: 'COMPLETE' },
  };
  const minaReady = {
    id: 'ob-mina',
    deal_id: 'rmwf-1',
    status: 'AVAILABLE_FOR_PAYOUT' as const,
    amount_owed: 400,
    currency: 'AUD',
    participant: { id: 'mina', name: 'Mina', onboardingStatus: 'COMPLETE' },
  };

  function surfaces(
    pilots: Parameters<typeof buildSettlementObligationRows>[0],
    receipts: Parameters<typeof buildSettlementObligationRows>[2] = [],
    attribution: Parameters<typeof buildSettlementObligationRows>[1] = []
  ) {
    const rows = buildSettlementObligationRows(pilots, attribution, receipts);
    const summary = summarizeSettlement(rows);
    const person = deriveReferralParticipantSettlementSummary(
      rows.filter((row) => row.participantId === pilots[0]?.participant?.id),
      Number(pilots[0]?.amount_owed) || 0
    );
    const earnings = attachEarningSettlementStatus(
      attribution.map(mapAttributionEarning),
      rows
    );
    return { rows, summary, person, earnings };
  }

  it('returns a Ready obligation after a draft release is removed', () => {
    const created = surfaces([leeReady], [{ participantId: 'lee', status: 'DRAFT' }]);
    expect(created.rows[0]?.workspaceStatus).toBe('released');
    expect(created.summary.owed).toBe(0);
    expect(created.summary.released).toBe(800);

    const removed = surfaces([leeReady], []);
    expect(removed.rows).toHaveLength(1);
    expect(removed.rows[0]?.workspaceStatus).toBe('ready');
    expect(removed.summary.readyForPayout).toBe(800);
    expect(removed.summary.owed).toBe(800);
    expect(removed.summary.released).toBe(0);
    expect(removed.summary.paid).toBe(0);
    expect(removed.person.status).toBe('ready');
  });

  it('never shows Paid after a submitted payout fails, and does not consume Ready', () => {
    const failed = surfaces([leeReady], [{ participantId: 'lee', status: 'FAILED' }], [
      {
        participantId: 'lee',
        participantName: 'Lee',
        dealId: 'rmwf-1',
        dealName: 'Referral Management',
        outstandingAmount: 800,
        paidAmount: 0,
        currency: 'AUD',
        items: [],
      },
    ]);
    const batch = mapPayoutBatch({
      id: 'batch-failed',
      currency: 'AUD',
      status: 'SUBMITTED',
      payoutCount: 1,
      totalAmount: 800,
      createdAt: '2026-08-22T00:00:00.000Z',
      payouts: [{ id: 'payout-failed', status: 'FAILED', participantId: 'lee' }],
    });

    expect(failed.rows[0]?.workspaceStatus).toBe('ready');
    expect(failed.rows[0]?.workspaceStatus).not.toBe('paid');
    expect(failed.rows[0]?.workspaceStatus).not.toBe('released');
    expect(failed.summary.owed).toBe(800);
    expect(failed.summary.readyForPayout).toBe(800);
    expect(failed.summary.released).toBe(0);
    expect(failed.summary.paid).toBe(0);
    expect(failed.person.status).toBe('ready');
    expect(failed.earnings[0]?.settlementStatus).toBe('ready');
    expect(failed.earnings[0]?.settlementStatus).not.toBe('paid');
    expect(batch.paymentState).toBe('failed');
    expect(batch.statusLabel).toBe('Released — payment failed');
  });

  it('does not invent a payout reversed or returned state', () => {
    const unknownReturn = surfaces([leeReady], [{ participantId: 'lee', status: 'RETURNED' }]);
    expect(unknownReturn.rows[0]?.workspaceStatus).toBe('ready');
    expect(unknownReturn.summary.paid).toBe(0);

    const dealReversed = buildSettlementObligationRows(
      [{ ...leeReady, status: 'REVERSED' }],
      []
    );
    expect(dealReversed[0]?.workspaceStatus).toBe('requires_action');
    expect(dealReversed[0]?.reason).toBe('Payment reversed');
    expect(summarizeSettlement(dealReversed).paid).toBe(0);
    expect(summarizeSettlement(dealReversed).owed).toBe(800);
  });

  it('keeps mixed PAID and FAILED receipts on their own participant obligations', () => {
    const rows = buildSettlementObligationRows(
      [leeReady, minaReady],
      [],
      [
        { participantId: 'lee', status: 'PAID' },
        { participantId: 'mina', status: 'FAILED' },
      ]
    );
    const summary = summarizeSettlement(rows);
    const batch = mapPayoutBatch({
      id: 'batch-mixed',
      currency: 'AUD',
      status: 'SUBMITTED',
      payoutCount: 2,
      totalAmount: 1200,
      createdAt: '2026-08-22T00:00:00.000Z',
      payouts: [
        { id: 'p-lee', status: 'PAID', participantId: 'lee' },
        { id: 'p-mina', status: 'FAILED', participantId: 'mina' },
      ],
    });
    const lee = deriveReferralParticipantSettlementSummary(
      rows.filter((row) => row.participantId === 'lee'),
      800
    );
    const mina = deriveReferralParticipantSettlementSummary(
      rows.filter((row) => row.participantId === 'mina'),
      400
    );

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.participantId === 'lee')?.workspaceStatus).toBe('paid');
    expect(rows.find((row) => row.participantId === 'mina')?.workspaceStatus).toBe('ready');
    expect(summary.paid).toBe(800);
    expect(summary.readyForPayout).toBe(400);
    expect(summary.released).toBe(0);
    expect(summary.owed).toBe(400);
    expect(summary.owed + summary.released + summary.paid).toBe(1200);
    expect(lee.status).toBe('paid');
    expect(mina.status).toBe('ready');
    expect(mina.status).not.toBe('paid');
    expect(batch.paymentState).toBe('failed');
    expect(batch.paymentState).not.toBe('paid');
    expect(batch.paidPayoutCount).toBe(1);
    expect(batch.paymentNote).toMatch(/1 of 2 payouts paid/);
  });

  it('cancels a draft release by dropping draft payouts and restoring Ready across surfaces', () => {
    const attribution = [
      {
        participantId: 'lee',
        participantName: 'Lee',
        dealId: 'rmwf-1',
        dealName: 'Referral Management',
        outstandingAmount: 800,
        paidAmount: 0,
        currency: 'AUD',
        items: [],
      },
    ];
    const ready = surfaces([leeReady], [], attribution);
    expect(ready.rows[0]?.workspaceStatus).toBe('ready');
    expect(ready.summary.owed).toBe(800);
    expect(ready.summary.readyForPayout).toBe(800);

    const draft = mapPayoutBatch({
      id: 'batch-draft',
      currency: 'AUD',
      status: 'DRAFT',
      payoutCount: 1,
      totalAmount: 800,
      createdAt: '2026-08-22T00:00:00.000Z',
      payouts: [{ id: 'p-draft', status: 'DRAFT', participantId: 'lee' }],
    });
    const created = surfaces([leeReady], [{ participantId: 'lee', status: 'DRAFT' }], attribution);
    expect(created.rows[0]?.workspaceStatus).toBe('released');
    expect(created.summary.released).toBe(800);
    expect(created.summary.owed).toBe(0);
    expect(created.person.status).toBe('released');
    expect(created.earnings[0]?.settlementStatus).toBe('released');
    expect(draft.cancellable).toBe(true);
    expect(canCancelDraftReleaseBatch({ batchStatus: 'DRAFT', payoutStatuses: ['DRAFT'] }).ok).toBe(
      true
    );

    const cancelled = surfaces([leeReady], [], attribution);
    expect(cancelled.rows).toHaveLength(1);
    expect(cancelled.rows[0]?.kind).toBe('pilot');
    expect(cancelled.rows[0]?.workspaceStatus).toBe('ready');
    expect(cancelled.summary.readyForPayout).toBe(800);
    expect(cancelled.summary.owed).toBe(800);
    expect(cancelled.summary.released).toBe(0);
    expect(cancelled.summary.paid).toBe(0);
    expect(cancelled.person.status).toBe('ready');
    expect(cancelled.earnings[0]?.settlementStatus).toBe('ready');
    expect(cancelled.earnings[0]?.settlementStatusLabel).toBe('Ready for payout');
  });

  it('does not allow submitted or paid releases to be cancelled', () => {
    expect(
      canCancelDraftReleaseBatch({ batchStatus: 'SUBMITTED', payoutStatuses: ['SUBMITTED'] })
    ).toEqual({ ok: false, code: 'not_draft_batch' });
    expect(
      canCancelDraftReleaseBatch({ batchStatus: 'COMPLETED', payoutStatuses: ['PAID'] })
    ).toEqual({ ok: false, code: 'not_draft_batch' });
    expect(
      canCancelDraftReleaseBatch({ batchStatus: 'DRAFT', payoutStatuses: ['SUBMITTED'] })
    ).toEqual({ ok: false, code: 'has_non_draft_payouts' });
    expect(
      canCancelDraftReleaseBatch({ batchStatus: 'DRAFT', payoutStatuses: ['PAID'] })
    ).toEqual({ ok: false, code: 'has_non_draft_payouts' });
    expect(
      mapPayoutBatch({
        id: 'batch-submitted',
        currency: 'AUD',
        status: 'SUBMITTED',
        payoutCount: 1,
        totalAmount: 800,
        createdAt: '2026-08-22T00:00:00.000Z',
        payouts: [{ id: 'p-sub', status: 'SUBMITTED', participantId: 'lee' }],
      }).cancellable
    ).toBe(false);
    expect(
      mapPayoutBatch({
        id: 'batch-paid',
        currency: 'AUD',
        status: 'COMPLETED',
        payoutCount: 1,
        totalAmount: 800,
        createdAt: '2026-08-22T00:00:00.000Z',
        payouts: [{ id: 'p-paid', status: 'PAID', participantId: 'lee' }],
      }).cancellable
    ).toBe(false);
  });
});
