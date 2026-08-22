import {
  attachEarningSettlementStatus,
  buildSettlementObligationRows,
  canCancelDraftReleaseBatch,
  filterSettlementObligations,
  mapAttributionEarning,
  mapPayoutBatch,
  summarizeSettlement,
  type AttributionEarningsApiRow,
  type PilotObligationApiRow,
} from '@/lib/settlement/workspace-settlement';
import {
  deriveReferralParticipantSettlementSummary,
  deriveReferralWorkflowSettlementSummary,
} from '@/lib/workflows/referral-management/settlement-summary';

function earning(
  participantId: string,
  name: string,
  outstanding: number,
  paid = 0
): AttributionEarningsApiRow {
  return {
    participantId,
    participantName: name,
    dealId: 'rmwf-1',
    dealName: 'Referral Management',
    outstandingAmount: outstanding,
    paidAmount: paid,
    currency: 'AUD',
    items: [
      {
        id: `${participantId}-item`,
        amount: outstanding + paid,
        currency: 'AUD',
        status: outstanding > 0 ? 'POSTED' : 'PAID',
        createdAt: '2026-08-10T00:00:00.000Z',
      },
    ],
  };
}

function pilot(
  overrides: Partial<PilotObligationApiRow> & Pick<PilotObligationApiRow, 'id'>
): PilotObligationApiRow {
  return {
    deal_id: 'rmwf-1',
    obligation_type: 'PARTICIPANT',
    status: 'DRAFT',
    amount_owed: 0,
    currency: 'AUD',
    deal: { id: 'rmwf-1', name: 'Referral Management' },
    ...overrides,
  };
}

describe('Settlement end-to-end scenario traces', () => {
  it('A: earned attribution with no pilot obligation becomes a pending owed row', () => {
    const attribution = [earning('jordan', 'Jordan', 250, 50)];
    const rows = buildSettlementObligationRows([], attribution);
    const summary = summarizeSettlement(rows);
    const rm = deriveReferralWorkflowSettlementSummary(rows, 300);
    const person = deriveReferralParticipantSettlementSummary(rows, 300);
    const earnings = attachEarningSettlementStatus(
      attribution.map(mapAttributionEarning),
      rows
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.workspaceStatus).toBe('pending');
    expect(summary.owed).toBe(250);
    expect(summary.pending).toBe(250);
    expect(summary.requiresAction).toBe(0);
    expect(summary.readyForPayout).toBe(0);
    expect(rm.earned).toBe(300);
    expect(rm.owed).toBe(250);
    expect(person.status).toBe('pending');
    expect(earnings[0]?.earned).toBe(300);
    expect(earnings[0]?.unpaid).toBe(250);
    expect(earnings[0]?.settlementStatus).toBe('pending');
  });

  it('B: owed commission awaiting payout details does not double-count money', () => {
    const attribution = [earning('sarah', 'Sarah', 300)];
    const rows = buildSettlementObligationRows(
      [
        pilot({
          id: 'ob-sarah',
          status: 'APPROVED',
          amount_owed: 300,
          participant: {
            id: 'sarah',
            name: 'Sarah',
            approvalStatus: 'Approved',
            onboardingStatus: 'INCOMPLETE',
          },
        }),
      ],
      attribution
    );
    const summary = summarizeSettlement(rows);
    const person = deriveReferralParticipantSettlementSummary(
      filterSettlementObligations(rows, { participant: 'sarah' }),
      300
    );
    const earnings = attachEarningSettlementStatus(
      attribution.map(mapAttributionEarning),
      rows
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe('pilot');
    expect(rows[0]?.workspaceStatus).toBe('requires_action');
    expect(summary.owed).toBe(300);
    expect(summary.requiresAction).toBe(300);
    expect(summary.pending).toBe(0);
    expect(person.status).toBe('requires_action');
    expect(person.owed).toBe(300);
    expect(earnings[0]?.settlementStatus).toBe('requires_action');
  });

  it('C: agreement fixed fee awaiting funding stays off Referral Management', () => {
    const rows = buildSettlementObligationRows(
      [
        pilot({
          id: 'ob-alex',
          deal_id: 'agree-1',
          obligation_type: 'fixed_fee',
          status: 'UNFUNDED',
          amount_owed: 1500,
          deal: { id: 'agree-1', name: 'Brand partnership' },
          participant: { id: 'alex', name: 'Alex', approvalStatus: 'Approved' },
        }),
      ],
      []
    );
    const all = summarizeSettlement(rows);
    const rm = summarizeSettlement(
      filterSettlementObligations(rows, { source: 'referral-management' })
    );
    expect(rows[0]?.source).toBe('agreements');
    expect(rows[0]?.workspaceStatus).toBe('requires_action');
    expect(all.owed).toBe(1500);
    expect(all.requiresAction).toBe(1500);
    expect(rm.owed).toBe(0);
  });

  it('D: revenue-share awaiting approval is requires action, not pending', () => {
    const rows = buildSettlementObligationRows(
      [
        {
          id: 'ob-priya',
          deal_id: 'rs-1',
          obligation_type: 'REVENUE_SHARE',
          status: 'PENDING_APPROVAL',
          amount_owed: 900,
          currency: 'AUD',
          deal: { id: 'rs-1', name: 'Studio share' },
          participant: { id: 'priya', name: 'Priya', approvalStatus: 'Pending approval' },
        },
      ],
      []
    );
    expect(rows[0]?.source).toBe('revenue-sharing');
    expect(rows[0]?.workspaceStatus).toBe('requires_action');
    expect(summarizeSettlement(rows).pending).toBe(0);
  });

  it('E: ready for payout is isolated from pending and requires action', () => {
    const rows = buildSettlementObligationRows(
      [
        pilot({
          id: 'ob-ready',
          status: 'AVAILABLE_FOR_PAYOUT',
          amount_owed: 800,
          participant: {
            id: 'lee',
            name: 'Lee',
            approvalStatus: 'Approved',
            onboardingStatus: 'COMPLETE',
          },
        }),
      ],
      []
    );
    const summary = summarizeSettlement(rows);
    expect(rows[0]?.workspaceStatus).toBe('ready');
    expect(summary.owed).toBe(800);
    expect(summary.readyForPayout).toBe(800);
    expect(summary.pending).toBe(0);
    expect(summary.requiresAction).toBe(0);
  });

  it('F: creating or submitting a release is Released / processing, not Paid', () => {
    const readyPilot = pilot({
      id: 'ob-ready',
      status: 'AVAILABLE_FOR_PAYOUT',
      amount_owed: 800,
      participant: { id: 'lee', name: 'Lee', onboardingStatus: 'COMPLETE' },
    });
    const created = buildSettlementObligationRows([readyPilot], [], [
      { participantId: 'lee', status: 'DRAFT' },
    ]);
    const submitted = buildSettlementObligationRows([readyPilot], [], [
      { participantId: 'lee', status: 'SUBMITTED' },
    ]);
    const batch = mapPayoutBatch({
      id: 'batch-1',
      currency: 'AUD',
      status: 'SUBMITTED',
      payoutCount: 1,
      totalAmount: 800,
      createdAt: '2026-08-22T00:00:00.000Z',
      payouts: [{ id: 'payout-1', status: 'SUBMITTED', participantId: 'lee' }],
    });
    const person = deriveReferralParticipantSettlementSummary(submitted, 800);
    const earnings = attachEarningSettlementStatus(
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
      submitted
    );

    expect(created[0]?.workspaceStatus).toBe('released');
    expect(submitted[0]?.workspaceStatus).toBe('released');
    expect(summarizeSettlement(created).paid).toBe(0);
    expect(summarizeSettlement(submitted).paid).toBe(0);
    expect(batch.paymentState).toBe('released');
    expect(batch.statusLabel).toBe('Released — processing');
    expect(person.status).toBe('released');
    expect(earnings[0]?.settlementStatus).toBe('released');
  });

  it('G: paid only when payout receipt is confirmed', () => {
    const paid = mapPayoutBatch({
      id: 'batch-2',
      currency: 'AUD',
      status: 'COMPLETED',
      payoutCount: 1,
      totalAmount: 800,
      createdAt: '2026-08-22T00:00:00.000Z',
      payouts: [{ id: 'payout-2', status: 'PAID' }],
    });
    const unconfirmed = mapPayoutBatch({
      id: 'batch-3',
      currency: 'AUD',
      status: 'COMPLETED',
      payoutCount: 1,
      totalAmount: 800,
      createdAt: '2026-08-22T00:00:00.000Z',
      payouts: [{ id: 'payout-3', status: 'SUBMITTED' }],
    });
    expect(paid.paymentState).toBe('paid');
    expect(unconfirmed.paymentState).toBe('released');
  });

  it('portfolio totals keep each dollar in one money bucket', () => {
    const attribution = [earning('jordan', 'Jordan', 250, 50), earning('sarah', 'Sarah', 300)];
    const rows = buildSettlementObligationRows(
      [
        pilot({
          id: 'ob-sarah',
          status: 'APPROVED',
          amount_owed: 300,
          participant: {
            id: 'sarah',
            name: 'Sarah',
            approvalStatus: 'Approved',
            onboardingStatus: 'INCOMPLETE',
          },
        }),
        {
          id: 'ob-alex',
          deal_id: 'agree-1',
          obligation_type: 'fixed_fee',
          status: 'UNFUNDED',
          amount_owed: 1500,
          currency: 'AUD',
          deal: { id: 'agree-1', name: 'Brand partnership' },
          participant: { id: 'alex', name: 'Alex' },
        },
        {
          id: 'ob-priya',
          deal_id: 'rs-1',
          obligation_type: 'REVENUE_SHARE',
          status: 'PENDING_APPROVAL',
          amount_owed: 900,
          currency: 'AUD',
          deal: { id: 'rs-1', name: 'Studio share' },
          participant: { id: 'priya', name: 'Priya', approvalStatus: 'Pending approval' },
        },
        pilot({
          id: 'ob-lee',
          status: 'AVAILABLE_FOR_PAYOUT',
          amount_owed: 800,
          participant: { id: 'lee', name: 'Lee', onboardingStatus: 'COMPLETE' },
        }),
        pilot({
          id: 'ob-paid',
          status: 'PAID',
          amount_owed: 400,
          participant: { id: 'mina', name: 'Mina', onboardingStatus: 'COMPLETE' },
        }),
      ],
      attribution
    );
    const summary = summarizeSettlement(rows);
    expect(summary.pending).toBe(250);
    expect(summary.requiresAction).toBe(300 + 1500 + 900);
    expect(summary.readyForPayout).toBe(800);
    expect(summary.owed).toBe(250 + 300 + 1500 + 900 + 800);
    expect(summary.paid).toBe(400);
    expect(summary.pending + summary.requiresAction + summary.readyForPayout).toBe(summary.owed);
  });

  it('seven-record surface audit stays internally consistent after integrity fixes', () => {
    const jordan = earning('jordan', 'Jordan', 250, 50);
    const sarah = earning('sarah', 'Sarah', 300);
    const leeReady = pilot({
      id: 'ob-lee',
      status: 'AVAILABLE_FOR_PAYOUT',
      amount_owed: 800,
      participant: { id: 'lee', name: 'Lee', onboardingStatus: 'COMPLETE' },
    });

    const portfolio = buildSettlementObligationRows(
      [
        pilot({
          id: 'ob-sarah',
          status: 'APPROVED',
          amount_owed: 300,
          participant: {
            id: 'sarah',
            name: 'Sarah',
            approvalStatus: 'Approved',
            onboardingStatus: 'INCOMPLETE',
          },
        }),
        {
          id: 'ob-alex',
          deal_id: 'agree-1',
          obligation_type: 'fixed_fee',
          status: 'UNFUNDED',
          amount_owed: 1500,
          currency: 'AUD',
          deal: { id: 'agree-1', name: 'Brand partnership' },
          participant: { id: 'alex', name: 'Alex' },
        },
        {
          id: 'ob-priya',
          deal_id: 'rs-1',
          obligation_type: 'REVENUE_SHARE',
          status: 'PENDING_APPROVAL',
          amount_owed: 900,
          currency: 'AUD',
          deal: { id: 'rs-1', name: 'Studio share' },
          participant: { id: 'priya', name: 'Priya', approvalStatus: 'Pending approval' },
        },
        leeReady,
        pilot({
          id: 'ob-paid',
          status: 'PAID',
          amount_owed: 400,
          participant: { id: 'mina', name: 'Mina', onboardingStatus: 'COMPLETE' },
        }),
      ],
      [jordan, sarah]
    );

    expect(portfolio.filter((row) => row.participantId === 'sarah')).toHaveLength(1);
    expect(portfolio.filter((row) => row.participantId === 'jordan')).toHaveLength(1);
    expect(summarizeSettlement(portfolio).owed).toBe(3750);

    const submittedLee = buildSettlementObligationRows([leeReady], [], [
      { participantId: 'lee', status: 'SUBMITTED' },
    ]);
    expect(submittedLee[0]?.workspaceStatus).toBe('released');
    expect(deriveReferralParticipantSettlementSummary(submittedLee, 800).status).not.toBe('paid');
    expect(
      attachEarningSettlementStatus([mapAttributionEarning(earning('lee', 'Lee', 800))], submittedLee)[0]
        ?.settlementStatus
    ).not.toBe('paid');
  });

  it('cancelling a draft release restores Ready on every settlement surface', () => {
    const readyPilot = pilot({
      id: 'ob-lee',
      status: 'AVAILABLE_FOR_PAYOUT',
      amount_owed: 800,
      participant: { id: 'lee', name: 'Lee', onboardingStatus: 'COMPLETE' },
    });
    const attribution = [earning('lee', 'Lee', 800)];
    const created = buildSettlementObligationRows(
      [readyPilot],
      attribution,
      [{ participantId: 'lee', status: 'DRAFT' }]
    );
    const cancelled = buildSettlementObligationRows([readyPilot], attribution, []);
    const draft = mapPayoutBatch({
      id: 'draft-1',
      currency: 'AUD',
      status: 'DRAFT',
      payoutCount: 1,
      totalAmount: 800,
      createdAt: '2026-08-22T00:00:00.000Z',
      payouts: [{ id: 'p-draft', status: 'DRAFT', participantId: 'lee' }],
    });

    expect(created[0]?.workspaceStatus).toBe('released');
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0]?.workspaceStatus).toBe('ready');
    expect(summarizeSettlement(cancelled).owed).toBe(800);
    expect(summarizeSettlement(cancelled).readyForPayout).toBe(800);
    expect(summarizeSettlement(cancelled).released).toBe(0);
    expect(deriveReferralParticipantSettlementSummary(cancelled, 800).status).toBe('ready');
    expect(
      attachEarningSettlementStatus(attribution.map(mapAttributionEarning), cancelled)[0]
        ?.settlementStatus
    ).toBe('ready');
    expect(draft.cancellable).toBe(true);
    expect(canCancelDraftReleaseBatch({ batchStatus: 'SUBMITTED', payoutStatuses: ['SUBMITTED'] }).ok).toBe(
      false
    );
    expect(canCancelDraftReleaseBatch({ batchStatus: 'COMPLETED', payoutStatuses: ['PAID'] }).ok).toBe(
      false
    );
  });
});
