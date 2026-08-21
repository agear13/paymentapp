import type { WorkflowOperationalParticipant } from '@/lib/workflows/agreement-intelligence/types';
import {
  buildReferralAttentionItems,
  filterCountsForPromoters,
  groupReferralAttention,
  promoterMatchesFilter,
} from '@/lib/workflows/referral-management/attention';

function promoter(
  overrides: Partial<WorkflowOperationalParticipant> = {}
): WorkflowOperationalParticipant {
  return {
    id: 'p-1',
    name: 'Event Agency Bali',
    commercialRole: 'Promoter',
    operationalRole: 'Promoter',
    partyKind: 'compensated_participant',
    statusLabel: 'Needs setup',
    approvalStatus: 'Pending approval',
    onboardingStatus: 'INCOMPLETE',
    needsAttention: true,
    attentionReason: 'Request approval',
    manageUrl: '/workspace/workflows/referral-management?participant=p-1',
    agreementStatus: 'not_requested',
    payoutSetupStatus: 'required',
    taxInformationStatus: 'required',
    referralStatus: 'ready',
    compensationKind: 'fixed',
    compensationLabel: '$3,000 fixed payment',
    nextActionLabel: 'Request approval',
    nextActionKind: 'request_approval',
    missingPayoutFields: [],
    referral: {
      code: null,
      url: null,
      qrUrl: null,
      destinationLabel: 'Demo booking',
      commissionLabel: null,
    },
    eligibleServiceIds: ['svc-1'],
    workspaceUrl: null,
    payoutReview: null,
    ...overrides,
  };
}

describe('Referral Management attention grouping', () => {
  it('groups by canonical kind, not display labels', () => {
    const items = buildReferralAttentionItems([
      promoter({ id: 'a', name: 'A', payoutSetupStatus: 'submitted', agreementStatus: 'approved' }),
      promoter({ id: 'b', name: 'B', payoutSetupStatus: 'submitted', agreementStatus: 'approved' }),
      promoter({ id: 'c', name: 'C', payoutSetupStatus: 'required', agreementStatus: 'not_requested' }),
    ]);
    const groups = groupReferralAttention(items);
    expect(groups.map((group) => group.kind)).toEqual([
      'commission_review',
      'approval_required',
      'payout_details',
    ]);
    expect(groups[0]?.count).toBe(2);
    expect(groups[0]?.summary).toBe('2 commissions ready for review');
    expect(items.every((item) => item.kind)).toBe(true);
  });

  it('prioritises commission review ahead of approval and payout collection', () => {
    const items = buildReferralAttentionItems([
      promoter({ id: 'payout', name: 'Payout', payoutSetupStatus: 'requested', agreementStatus: 'approved' }),
      promoter({
        id: 'review',
        name: 'Review',
        payoutSetupStatus: 'submitted',
        agreementStatus: 'approved',
      }),
      promoter({
        id: 'approval',
        name: 'Approval',
        payoutSetupStatus: 'complete',
        agreementStatus: 'not_requested',
      }),
    ]);
    expect(items.map((item) => item.kind)).toEqual([
      'commission_review',
      'approval_required',
      'payout_details',
    ]);
  });

  it('does not emit an unbounded main-page list shape — groups stay compact', () => {
    const promoters = Array.from({ length: 24 }, (_, index) =>
      promoter({
        id: `p-${index}`,
        name: `Promoter ${index}`,
        payoutSetupStatus: 'required',
        agreementStatus: 'not_requested',
      })
    );
    const groups = groupReferralAttention(buildReferralAttentionItems(promoters));
    expect(groups).toHaveLength(2);
    expect(groups.reduce((sum, group) => sum + group.count, 0)).toBe(48);
  });

  it('filters promoters by canonical status when an attention category is selected', () => {
    const rows = [
      promoter({
        id: 'sarah',
        name: 'Sarah',
        payoutSetupStatus: 'submitted',
        agreementStatus: 'approved',
        needsAttention: true,
        referralStatus: 'active',
      }),
      promoter({
        id: 'benji',
        name: 'Benji Matt',
        payoutSetupStatus: 'required',
        agreementStatus: 'not_requested',
        needsAttention: true,
        referralStatus: 'ready',
      }),
      promoter({
        id: 'active',
        name: 'Active Co',
        payoutSetupStatus: 'complete',
        agreementStatus: 'approved',
        needsAttention: false,
        referralStatus: 'active',
        nextActionKind: 'none',
      }),
    ];
    expect(rows.filter((row) => promoterMatchesFilter(row, 'commission_review')).map((row) => row.id)).toEqual([
      'sarah',
    ]);
    expect(rows.filter((row) => promoterMatchesFilter(row, 'approval_required')).map((row) => row.id)).toEqual([
      'benji',
    ]);
    expect(rows.filter((row) => promoterMatchesFilter(row, 'active')).map((row) => row.id)).toEqual([
      'sarah',
      'active',
    ]);
    expect(filterCountsForPromoters(rows).attention).toBe(2);
  });

  it('returns no groups when there is nothing to do', () => {
    expect(
      groupReferralAttention(
        buildReferralAttentionItems([
          promoter({
            payoutSetupStatus: 'complete',
            agreementStatus: 'approved',
            needsAttention: false,
            nextActionKind: 'none',
          }),
        ])
      )
    ).toEqual([]);
  });
});
