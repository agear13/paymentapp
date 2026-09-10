import { DealNetworkPilotObligationStatus } from '@prisma/client';
import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  deriveAgreementApprovalState,
  deriveObligationApprovalState,
  obligationApprovalLabel,
} from '@/lib/operations/derivations/derive-approval-state';
import { hasOperatorConfirmedPayoutDetails } from '@/lib/operations/primitives/participant-earnings-primitives';
import { resolvePersistedObligationStatus } from '@/lib/operations/derivations/derive-obligation-allocation-status';
import { derivePayoutDetailsOrganiserStatus } from '@/lib/participant-portal/participant-workspace-onboarding';
import { classifyWorkspaceStatus, mapPilotObligation } from '@/lib/settlement/workspace-settlement';
import {
  getObligationBlockingIssue,
  getObligationNextAction,
} from '@/lib/payouts/obligation-status-labels';
import { deriveParticipantCommercialLifecycle } from '@/lib/commercial/participant-commercial-lifecycle';

function deal(): RecentDeal {
  return {
    id: 'deal-confirm',
    dealName: 'Operator confirmation',
    partner: 'Acme',
    value: 10000,
    introducer: '—',
    closer: '—',
    status: 'Approved',
    lastUpdated: '2026-01-01',
    paymentStatus: 'Not Paid',
    setupStatus: 'configuring',
  };
}

function baseParticipant(overrides: Record<string, unknown> = {}) {
  const p = buildProjectParticipant({
    name: 'Alisha',
    email: 'alisha@example.com',
    role: 'Contractor',
    project: deal(),
    participationModel: 'fixed_payout',
    commissionKind: 'fixed_amount',
    commissionValue: 100,
    enableCustomerAttribution: false,
  });
  return {
    ...p,
    compensationProfile: { ...p.compensationProfile!, configured: true, fixedAmount: 100 },
    ...overrides,
  };
}

function approvedUnverified() {
  return baseParticipant({
    approvalStatus: 'Approved' as const,
    approvedAt: '2026-06-01T00:00:00.000Z',
    payoutVerificationConfirmed: false,
    supplierOnboarding: {
      lifecycle: 'SUBMITTED',
      submission: { submittedAt: '2026-06-03T00:00:00.000Z', declarationAccepted: true },
    },
  });
}

function approvedViaSupplierLifecycle() {
  return baseParticipant({
    approvalStatus: 'Approved' as const,
    approvedAt: '2026-06-01T00:00:00.000Z',
    payoutVerificationConfirmed: false,
    supplierOnboarding: {
      lifecycle: 'APPROVED',
      submission: { submittedAt: '2026-06-03T00:00:00.000Z', declarationAccepted: true },
      operator: { approvedAt: '2026-06-04T00:00:00.000Z', xeroExportedAt: null, notes: null },
      verification: { supplierApproved: true },
      approval: { approvedAt: '2026-06-04T00:00:00.000Z' },
    },
  });
}

function approvedViaFlag() {
  return baseParticipant({
    approvalStatus: 'Approved' as const,
    approvedAt: '2026-06-01T00:00:00.000Z',
    payoutVerificationConfirmed: true,
  });
}

describe('canonical operator payout confirmation', () => {
  it('treats supplier onboarding APPROVED and payoutVerificationConfirmed as the same event', () => {
    expect(hasOperatorConfirmedPayoutDetails(approvedViaSupplierLifecycle())).toBe(true);
    expect(hasOperatorConfirmedPayoutDetails(approvedViaFlag())).toBe(true);
    expect(hasOperatorConfirmedPayoutDetails(approvedUnverified())).toBe(false);
  });

  it('does not treat participant-complete signals as operator confirmation', () => {
    const participantComplete = baseParticipant({
      approvalStatus: 'Approved' as const,
      approvedAt: '2026-06-01T00:00:00.000Z',
      payoutVerificationConfirmed: false,
      payoutOnboardingPhase: 'COMPLETED',
      onboardingStatus: 'COMPLETE',
      supplierOnboarding: {
        lifecycle: 'SUBMITTED',
        submission: { submittedAt: '2026-06-03T00:00:00.000Z', declarationAccepted: true },
      },
    });
    expect(hasOperatorConfirmedPayoutDetails(participantComplete)).toBe(false);
    expect(deriveAgreementApprovalState(participantComplete)).toBe('participant_approved');
  });

  it('is fully_approved when agreement is approved and operator confirmed payout details', () => {
    expect(deriveAgreementApprovalState(approvedViaFlag())).toBe('fully_approved');
    expect(deriveAgreementApprovalState(approvedViaSupplierLifecycle())).toBe('fully_approved');
  });

  it('is not fully_approved when agreement is approved without operator confirmation', () => {
    expect(deriveAgreementApprovalState(approvedUnverified())).toBe('participant_approved');
    expect(hasOperatorConfirmedPayoutDetails(approvedUnverified())).toBe(false);
  });

  it('keeps unapproved participants pending regardless of payout confirmation', () => {
    const pending = baseParticipant({
      approvalStatus: 'Pending approval' as const,
      payoutVerificationConfirmed: true,
    });
    expect(deriveAgreementApprovalState(pending)).toBe('operator_confirmed');
    expect(
      deriveObligationApprovalState({
        obligationStatus: 'PENDING_APPROVAL',
        participant: pending,
      })
    ).toBe('pending_operator');
  });

  it('persists UNFUNDED when operator-confirmed and unfunded', () => {
    const participant = approvedViaSupplierLifecycle();
    const status = resolvePersistedObligationStatus({
      participant,
      deal: deal(),
      moneyConfirmed: false,
      fullyFunded: false,
    });
    expect(status).toBe(DealNetworkPilotObligationStatus.UNFUNDED);
    expect(classifyWorkspaceStatus({ status })).toBe('requires_action');
    expect(
      getObligationBlockingIssue({
        status,
        obligation_type: 'PARTICIPANT',
        participant: {
          id: participant.id,
          name: participant.name,
          approvalStatus: 'Approved',
          payoutVerificationConfirmed: true,
        },
      })
    ).toBe('Funding not reserved');
  });

  it('persists AVAILABLE_FOR_PAYOUT when operator-confirmed and funded', () => {
    const participant = approvedViaSupplierLifecycle();
    const status = resolvePersistedObligationStatus({
      participant,
      deal: deal(),
      moneyConfirmed: true,
      fullyFunded: true,
    });
    expect(status).toBe(DealNetworkPilotObligationStatus.AVAILABLE_FOR_PAYOUT);
    expect(classifyWorkspaceStatus({ status })).toBe('ready');
  });

  it('keeps missing operator confirmation blocked from payout', () => {
    const participant = approvedUnverified();
    const status = resolvePersistedObligationStatus({
      participant,
      deal: deal(),
      moneyConfirmed: true,
      fullyFunded: true,
    });
    expect(status).toBe(DealNetworkPilotObligationStatus.PENDING_APPROVAL);
    expect(classifyWorkspaceStatus({ status })).not.toBe('ready');
    expect(
      obligationApprovalLabel(
        deriveObligationApprovalState({
          obligationStatus: status,
          participant,
        }),
        participant
      )
    ).toBe('Payment setup required');
  });

  it('keeps People Verified aligned with Settlement operator confirmation', () => {
    const verified = approvedViaSupplierLifecycle();
    expect(derivePayoutDetailsOrganiserStatus(verified)).toBe('Verified');
    expect(deriveAgreementApprovalState(verified)).toBe('fully_approved');

    const unverified = approvedUnverified();
    expect(derivePayoutDetailsOrganiserStatus(unverified)).toBe('Submitted');
    expect(deriveAgreementApprovalState(unverified)).toBe('participant_approved');
  });

  it('does not let Xero disconnection change persisted settlement status', () => {
    const participant = {
      ...approvedViaSupplierLifecycle(),
      paymentSetup: { xeroExportedAt: undefined, xeroSyncStatus: undefined },
    };
    expect(participant.paymentSetup?.xeroExportedAt).toBeFalsy();
    expect(
      resolvePersistedObligationStatus({
        participant,
        deal: deal(),
        moneyConfirmed: true,
        fullyFunded: true,
      })
    ).toBe(DealNetworkPilotObligationStatus.AVAILABLE_FOR_PAYOUT);
    expect(deriveParticipantCommercialLifecycle(participant)).toBe('SETTLEMENT_READY');
  });

  it('maps Settlement attention from the same confirmation field People uses', () => {
    const row = mapPilotObligation({
      id: 'ob-100',
      deal_id: deal().id,
      participant_id: 'p-alisha',
      obligation_type: 'PARTICIPANT',
      status: 'UNFUNDED',
      amount_owed: 100,
      currency: 'AUD',
      participant: {
        id: 'p-alisha',
        name: 'Alisha',
        approvalStatus: 'Approved',
        payoutVerificationConfirmed: true,
      },
    });
    expect(row.reason).toBe('Funding not reserved');
    expect(row.workspaceStatus).toBe('requires_action');
    expect(row.workspaceStatus).not.toBe('ready');
  });

  it('persists PENDING_APPROVAL when unfunded but operator has not confirmed', () => {
    const participant = approvedUnverified();
    const status = resolvePersistedObligationStatus({
      participant,
      deal: deal(),
      moneyConfirmed: false,
      fullyFunded: false,
    });
    expect(status).toBe(DealNetworkPilotObligationStatus.PENDING_APPROVAL);
    expect(
      getObligationNextAction({
        status,
        obligation_type: 'PARTICIPANT',
        participant: {
          id: participant.id,
          name: participant.name,
          approvalStatus: 'Approved',
          payoutVerificationConfirmed: false,
        },
      })
    ).toBe('Complete supplier setup');
    expect(
      getObligationBlockingIssue({
        status,
        obligation_type: 'PARTICIPANT',
        participant: {
          id: participant.id,
          name: participant.name,
          approvalStatus: 'Approved',
          payoutVerificationConfirmed: false,
        },
      })
    ).toBe('Payment setup required');
  });

  it('does not treat stale PENDING_APPROVAL plus live operator confirmation as supplier setup', () => {
    const row = mapPilotObligation({
      id: 'ob-stale',
      deal_id: deal().id,
      participant_id: 'p-alisha',
      obligation_type: 'PARTICIPANT',
      status: 'PENDING_APPROVAL',
      amount_owed: 100,
      currency: 'AUD',
      participant: {
        id: 'p-alisha',
        name: 'Alisha',
        approvalStatus: 'Approved',
        payoutVerificationConfirmed: true,
      },
    });
    expect(row.reason).toBe('Funding not reserved');
    expect(row.nextAction).toBe('Funding not reserved');
    expect(row.reason).not.toBe('Ready for release');
    expect(row.nextAction).not.toBe('Complete supplier setup');
    expect(row.workspaceStatus).toBe('requires_action');
    expect(row.workspaceStatus).not.toBe('ready');
  });

  it('maps funded operator-confirmed obligations into Releases', () => {
    const row = mapPilotObligation({
      id: 'ob-ready',
      deal_id: deal().id,
      participant_id: 'p-alisha',
      obligation_type: 'PARTICIPANT',
      status: 'AVAILABLE_FOR_PAYOUT',
      amount_owed: 100,
      currency: 'AUD',
      participant: {
        id: 'p-alisha',
        name: 'Alisha',
        approvalStatus: 'Approved',
        payoutVerificationConfirmed: true,
      },
    });
    expect(row.workspaceStatus).toBe('ready');
    expect(row.reason).toBeNull();
    expect(row.nextAction).toBe('Ready to release');
  });
});
