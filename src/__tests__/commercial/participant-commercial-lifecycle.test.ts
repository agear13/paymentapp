/**
 * Participant Commercial Lifecycle — regression tests
 */

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  deriveParticipantCommercialLifecycle,
  deriveParticipantCommercialTablePresentation,
  deriveParticipantLifecycleAction,
  deriveWorkspaceLifecycleSummary,
  shouldRequestPayoutDetails,
} from '@/lib/commercial/participant-commercial-lifecycle';

function baseParticipant(overrides: Partial<DemoParticipant> = {}): DemoParticipant {
  return {
    id: 'p-1',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'Venue Manager',
    approvalStatus: 'Pending approval',
    commissionKind: 'fixed_amount',
    commissionValue: 5000,
    compensationProfile: {
      compensationType: 'FIXED_FEE',
      fixedAmount: 5000,
      configured: true,
      configuredAt: '2024-01-01T00:00:00Z',
      revenueSources: [],
      exemptFromPayout: false,
    },
    ...overrides,
  } as DemoParticipant;
}

describe('participant-commercial-lifecycle', () => {
  it('derives one mutually exclusive next action for every workflow state', () => {
    const cases: Array<{
      name: string;
      participant: DemoParticipant;
      stage: ReturnType<typeof deriveParticipantCommercialLifecycle>;
      nextAction: string;
    }> = [
      {
        name: 'earnings not configured',
        participant: baseParticipant({ compensationProfile: undefined, commissionValue: 0 }),
        stage: 'DRAFT',
        nextAction: 'Configure Earnings',
      },
      {
        name: 'agreement not sent',
        participant: baseParticipant(),
        stage: 'EARNINGS_CONFIGURED',
        nextAction: 'Send Agreement',
      },
      {
        name: 'agreement pending',
        participant: baseParticipant({
          inviteSentAt: '2024-01-02T00:00:00Z',
          inviteStatus: 'Invited',
        }),
        stage: 'AGREEMENT_SENT',
        nextAction: 'Waiting for Acceptance',
      },
      {
        name: 'agreement accepted but payout details missing',
        participant: baseParticipant({
          approvalStatus: 'Approved',
          approvedAt: '2024-01-03T00:00:00Z',
        }),
        stage: 'AGREEMENT_ACCEPTED',
        nextAction: 'Request Payout Details',
      },
      {
        name: 'payout request sent but participant has not submitted',
        participant: baseParticipant({
          approvalStatus: 'Approved',
          approvedAt: '2024-01-03T00:00:00Z',
          paymentSetup: {
            paymentRequestGeneratedAt: '2024-01-04T00:00:00Z',
            token: 'tok',
            tokenExpiresAt: '2099-01-01T00:00:00Z',
          },
          supplierOnboarding: { lifecycle: 'INVITED' },
          payoutOnboardingPhase: 'INVITED',
        }),
        stage: 'PAYMENT_INFO_PENDING',
        nextAction: 'Waiting for Participant',
      },
      {
        name: 'payout details submitted but not verified',
        participant: baseParticipant({
          approvalStatus: 'Approved',
          approvedAt: '2024-01-03T00:00:00Z',
          supplierOnboarding: {
            lifecycle: 'SUBMITTED',
            submission: { submittedAt: '2024-01-04T00:00:00Z', declarationAccepted: true },
          },
        }),
        stage: 'PAYMENT_INFO_SUBMITTED',
        nextAction: 'Verify Payout Details',
      },
      {
        name: 'commercial data verified and ready for Xero',
        participant: baseParticipant({
          approvalStatus: 'Approved',
          supplierOnboarding: { lifecycle: 'APPROVED' },
          payoutVerificationConfirmed: true,
        }),
        stage: 'XERO_INVOICE',
        nextAction: 'Push to Xero',
      },
      {
        name: 'supplier bill created',
        participant: baseParticipant({
          approvalStatus: 'Approved',
          supplierOnboarding: { lifecycle: 'APPROVED' },
          paymentSetup: {
            xeroExportedAt: '2024-01-05T00:00:00Z',
            xeroSyncStatus: 'synced',
          },
        }),
        stage: 'SETTLEMENT_READY',
        nextAction: 'Ready for Settlement',
      },
      {
        name: 'settlement completed',
        participant: baseParticipant({
          approvalStatus: 'Approved',
          supplierOnboarding: { lifecycle: 'APPROVED' },
          paymentSetup: {
            xeroExportedAt: '2024-01-05T00:00:00Z',
            xeroSyncStatus: 'synced',
          },
          payoutSettlementStatus: 'Paid',
          payoutPaidAt: '2024-01-06T00:00:00Z',
        }),
        stage: 'PAID',
        nextAction: 'Paid',
      },
    ];

    for (const item of cases) {
      const stage = deriveParticipantCommercialLifecycle(item.participant);
      const table = deriveParticipantCommercialTablePresentation(item.participant);
      expect(stage).toBe(item.stage);
      expect(table.stage).toBe(item.stage);
      expect(table.nextAction.label).toBe(item.nextAction);
      expect(table.nextAction.label).not.toEqual('');
    }
  });

  it('draft participant without earnings stays at DRAFT', () => {
    const p = baseParticipant({
      compensationProfile: undefined,
      commissionValue: 0,
    });
    expect(deriveParticipantCommercialLifecycle(p)).toBe('DRAFT');
    expect(shouldRequestPayoutDetails(p)).toBe(false);
  });

  it('earnings configured without agreement stays at EARNINGS_CONFIGURED', () => {
    const p = baseParticipant();
    expect(deriveParticipantCommercialLifecycle(p)).toBe('EARNINGS_CONFIGURED');
    expect(shouldRequestPayoutDetails(p)).toBe(false);
    const action = deriveParticipantLifecycleAction(p);
    expect(action.label).toBe('Send Agreement');
  });

  it('inviteStatus alone does not imply agreement sent', () => {
    const p = baseParticipant({
      inviteStatus: 'Invited',
      email: '',
    });
    expect(deriveParticipantCommercialLifecycle(p)).toBe('DRAFT');
    const table = deriveParticipantCommercialTablePresentation(p);
    expect(table.commercialChip).toBe('Not Started');
    expect(table.commercialChip).not.toMatch(/Agreement Sent/i);
  });

  it('missing email keeps participant in DRAFT with awaiting agreement commercial column', () => {
    const p = baseParticipant({ email: '' });
    expect(deriveParticipantCommercialLifecycle(p)).toBe('DRAFT');
    const table = deriveParticipantCommercialTablePresentation(p);
    expect(table.agreementChip).toBe('Draft');
    expect(table.commercialChip).toBe('Not Started');
    expect(table.payoutColumnActive).toBe(false);
  });

  it('sent agreement awaiting acceptance is AGREEMENT_SENT', () => {
    const p = baseParticipant({
      inviteSentAt: '2024-01-02T00:00:00Z',
      inviteStatus: 'Invited',
    });
    expect(deriveParticipantCommercialLifecycle(p)).toBe('AGREEMENT_SENT');
    expect(shouldRequestPayoutDetails(p)).toBe(false);
  });

  it('approved agreement without payment request stays AGREEMENT_ACCEPTED', () => {
    const p = baseParticipant({
      approvalStatus: 'Approved',
      approvedAt: '2024-01-03T00:00:00Z',
    });
    expect(deriveParticipantCommercialLifecycle(p)).toBe('AGREEMENT_ACCEPTED');
    expect(shouldRequestPayoutDetails(p)).toBe(true);
  });

  it('payment request sent moves to PAYMENT_INFO_PENDING', () => {
    const p = baseParticipant({
      approvalStatus: 'Approved',
      approvedAt: '2024-01-03T00:00:00Z',
      paymentSetup: {
        paymentRequestGeneratedAt: '2024-01-04T00:00:00Z',
        token: 'tok',
        tokenExpiresAt: '2099-01-01T00:00:00Z',
      },
      supplierOnboarding: { lifecycle: 'INVITED' },
      payoutOnboardingPhase: 'INVITED',
    });
    expect(deriveParticipantCommercialLifecycle(p)).toBe('PAYMENT_INFO_PENDING');
    const action = deriveParticipantLifecycleAction(p);
    expect(action.label).toBe('Waiting for Participant');
    expect(action.destination).toBe('await_participant');
  });

  it('submitted onboarding requires payout verification', () => {
    const p = baseParticipant({
      approvalStatus: 'Approved',
      approvedAt: '2024-01-03T00:00:00Z',
      supplierOnboarding: {
        lifecycle: 'SUBMITTED',
        submission: { submittedAt: '2024-01-04T00:00:00Z', declarationAccepted: true },
      },
    });
    expect(deriveParticipantCommercialLifecycle(p)).toBe('PAYMENT_INFO_SUBMITTED');
    const action = deriveParticipantLifecycleAction(p);
    expect(action.label).toBe('Verify Payout Details');
    expect(action.destination).toBe('review_payment');
  });

  it('operator approved unlocks Xero stage', () => {
    const p = baseParticipant({
      approvalStatus: 'Approved',
      supplierOnboarding: { lifecycle: 'APPROVED' },
      payoutVerificationConfirmed: true,
    });
    expect(deriveParticipantCommercialLifecycle(p)).toBe('XERO_INVOICE');
    const action = deriveParticipantLifecycleAction(p);
    expect(action.label).toBe('Push to Xero');
    const table = deriveParticipantCommercialTablePresentation(p);
    expect(table.commercialChip).toBe('Ready for Xero');
    expect(table.nextAction.label).toBe('Push to Xero');
  });

  it('supplier bill created moves to ready for settlement', () => {
    const p = baseParticipant({
      approvalStatus: 'Approved',
      supplierOnboarding: { lifecycle: 'APPROVED' },
      paymentSetup: {
        xeroExportedAt: '2024-01-05T00:00:00Z',
        xeroSyncStatus: 'synced',
      },
    });
    expect(deriveParticipantCommercialLifecycle(p)).toBe('SETTLEMENT_READY');
    const action = deriveParticipantLifecycleAction(p);
    expect(action.label).toBe('Ready for Settlement');
    const table = deriveParticipantCommercialTablePresentation(p);
    expect(table.nextAction.label).toBe('Ready for Settlement');
  });

  it('settlement completed is terminal paid state', () => {
    const p = baseParticipant({
      approvalStatus: 'Approved',
      supplierOnboarding: { lifecycle: 'APPROVED' },
      paymentSetup: {
        xeroExportedAt: '2024-01-05T00:00:00Z',
        xeroSyncStatus: 'synced',
      },
      payoutSettlementStatus: 'Paid',
      payoutPaidAt: '2024-01-06T00:00:00Z',
    });
    expect(deriveParticipantCommercialLifecycle(p)).toBe('PAID');
    const action = deriveParticipantLifecycleAction(p);
    expect(action.label).toBe('Paid');
    const table = deriveParticipantCommercialTablePresentation(p);
    expect(table.nextAction.label).toBe('Paid');
  });

  it('workspace summary shows next required action by stage priority', () => {
    const summary = deriveWorkspaceLifecycleSummary([
      baseParticipant(),
      baseParticipant({
        id: 'p-2',
        approvalStatus: 'Approved',
        supplierOnboarding: { lifecycle: 'SUBMITTED' },
      }),
    ]);
    expect(summary.primaryNotification?.message).toContain('ready to send');
    expect(summary.byStage.EARNINGS_CONFIGURED).toBe(1);
    expect(summary.byStage.PAYMENT_INFO_SUBMITTED).toBe(1);
  });

  it('never flags payout details before agreement acceptance in workspace notifications', () => {
    const summary = deriveWorkspaceLifecycleSummary([
      baseParticipant({ id: 'a' }),
      baseParticipant({ id: 'b', inviteSentAt: '2024-01-01' }),
    ]);
    const messages = summary.notifications.map((n) => n.message).join(' ');
    expect(messages).not.toMatch(/payout details/i);
    expect(messages).toMatch(/earnings configuration|ready to send|awaiting acceptance/i);
  });
});
