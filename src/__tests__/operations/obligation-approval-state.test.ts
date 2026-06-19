import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import {
  deriveObligationApprovalState,
  obligationApprovalLabel,
} from '@/lib/operations/derivations/derive-approval-state';
import {
  getObligationBlockingIssue,
  operatorStatusLabel,
} from '@/lib/payouts/obligation-status-labels';

function baseDeal() {
  return {
    id: 'deal-1',
    dealName: 'Test',
    partner: 'Test',
    value: 1000,
    introducer: '—',
    closer: '—',
    status: 'Pending',
    lastUpdated: new Date().toISOString(),
    paymentStatus: 'Not Paid',
    setupStatus: 'configuring',
  };
}

describe('obligation approval state', () => {
  it('pending participant when agreement not approved', () => {
    const participant = buildProjectParticipant({
      name: 'Coastal Media',
      role: 'Partner',
      project: baseDeal(),
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 500,
      enableCustomerAttribution: false,
    });

    const state = deriveObligationApprovalState({
      obligationStatus: 'PENDING_APPROVAL',
      participant,
    });
    expect(state).toBe('pending_participant');
    expect(obligationApprovalLabel(state, participant)).toContain('Coastal Media');
  });

  it('pending_operator when participant approved but supplier onboarding not yet complete', () => {
    const participant = buildProjectParticipant({
      name: 'Coastal Media',
      role: 'Partner',
      project: baseDeal(),
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 500,
      enableCustomerAttribution: false,
    });
    participant.approvalStatus = 'Approved';
    participant.payoutVerificationConfirmed = false;

    const state = deriveObligationApprovalState({
      obligationStatus: 'PENDING_APPROVAL',
      participant,
    });
    expect(state).toBe('pending_operator');
  });

  it('ready when participant approved, payout verified, and obligation row stale', () => {
    const participant = buildProjectParticipant({
      name: 'Coastal Media',
      role: 'Partner',
      project: baseDeal(),
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 500,
      enableCustomerAttribution: false,
    });
    participant.approvalStatus = 'Approved';
    participant.payoutVerificationConfirmed = true;
    participant.compensationProfile = { ...(participant.compensationProfile || {}), configured: true };

    const state = deriveObligationApprovalState({
      obligationStatus: 'PENDING_APPROVAL',
      participant,
    });
    expect(state).toBe('ready');
  });

  it('obligation labels replace generic awaiting approval', () => {
    const participant = buildProjectParticipant({
      name: 'Coastal Media',
      role: 'Partner',
      project: baseDeal(),
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 500,
      enableCustomerAttribution: false,
    });

    const label = operatorStatusLabel('PENDING_APPROVAL', participant);
    expect(label).not.toBe('Awaiting approval');
    expect(label).toContain('Coastal Media');

    const blocker = getObligationBlockingIssue({
      status: 'PENDING_APPROVAL',
      obligation_type: 'PARTICIPANT',
      participant: {
        id: participant.id,
        name: participant.name,
        approvalStatus: participant.approvalStatus,
      },
    });
    expect(blocker).toContain('Coastal Media');
  });
});
