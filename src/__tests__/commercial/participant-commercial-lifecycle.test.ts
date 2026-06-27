/**
 * Participant Commercial Lifecycle — regression tests
 */

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  deriveParticipantOperationalWorkflow,
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
  function expectWorkflow(
    participant: DemoParticipant,
    expected: {
      stage: ReturnType<typeof deriveParticipantCommercialLifecycle>;
      badge: string;
      cta: string;
      readiness: ReturnType<typeof deriveParticipantOperationalWorkflow>['readiness'];
      progressStep: number;
      visibleButton: boolean;
    }
  ) {
    const workflow = deriveParticipantOperationalWorkflow(participant);
    const table = deriveParticipantCommercialTablePresentation(participant);
    const action = deriveParticipantLifecycleAction(participant);

    expect(workflow.stage).toBe(expected.stage);
    expect(workflow.badge).toBe(expected.badge);
    expect(workflow.primaryCta.label).toBe(expected.cta);
    expect(workflow.readiness).toBe(expected.readiness);
    expect(workflow.progress.currentStep).toBe(expected.progressStep);
    expect(workflow.secondaryCtas).toHaveLength(0);
    expect(action.label).toBe(expected.cta);
    expect(table.workflow).toEqual(workflow);
    expect(table.nextAction.label).toBe(expected.cta);
    expect(table.commercialChip).toBe(expected.badge);

    const hasClickableTableAction = table.nextAction.kind !== 'waiting_participant'
      && table.nextAction.kind !== 'ready_for_settlement'
      && table.nextAction.kind !== 'completed'
      && table.nextAction.kind !== 'none';
    expect(hasClickableTableAction).toBe(expected.visibleButton);
  }

  it('executes the complete participant operational workflow without regression', () => {
    let participant = baseParticipant({
      commissionValue: 0,
      compensationProfile: undefined,
      approvalStatus: 'Pending approval',
    });

    expectWorkflow(participant, {
      stage: 'DRAFT',
      badge: 'Configure Earnings',
      cta: 'Configure Earnings',
      readiness: 'blocked',
      progressStep: 1,
      visibleButton: true,
    });

    participant = baseParticipant();
    expectWorkflow(participant, {
      stage: 'EARNINGS_CONFIGURED',
      badge: 'Agreement Ready',
      cta: 'Send Agreement',
      readiness: 'ready',
      progressStep: 2,
      visibleButton: true,
    });

    participant = {
      ...participant,
      agreementUrl: '/agreement/p-1',
      inviteSentAt: '2024-01-02T00:00:00Z',
      inviteStatus: 'Invited',
    };
    expectWorkflow(participant, {
      stage: 'AGREEMENT_SENT',
      badge: 'Waiting for Acceptance',
      cta: 'Waiting for Acceptance',
      readiness: 'waiting',
      progressStep: 3,
      visibleButton: false,
    });

    participant = {
      ...participant,
      approvalStatus: 'Approved',
      approvedAt: '2024-01-03T00:00:00Z',
    };
    expectWorkflow(participant, {
      stage: 'AGREEMENT_ACCEPTED',
      badge: 'Agreement Accepted',
      cta: 'Request Payout Details',
      readiness: 'ready',
      progressStep: 4,
      visibleButton: true,
    });

    participant = {
      ...participant,
      paymentSetup: {
        paymentRequestGeneratedAt: '2024-01-04T00:00:00Z',
        token: 'tok',
        tokenExpiresAt: '2099-01-01T00:00:00Z',
      },
      supplierOnboarding: { lifecycle: 'INVITED' },
      payoutOnboardingPhase: 'INVITED',
    };
    expectWorkflow(participant, {
      stage: 'PAYMENT_INFO_PENDING',
      badge: 'Waiting for Participant',
      cta: 'Waiting for Participant',
      readiness: 'waiting',
      progressStep: 5,
      visibleButton: false,
    });

    participant = {
      ...participant,
      supplierOnboarding: {
        lifecycle: 'SUBMITTED',
        submission: { submittedAt: '2024-01-05T00:00:00Z', declarationAccepted: true },
      },
      payoutOnboardingPhase: 'SUBMITTED',
    };
    expectWorkflow(participant, {
      stage: 'PAYMENT_INFO_SUBMITTED',
      badge: 'Verify Payout Details',
      cta: 'Verify Payout Details',
      readiness: 'ready',
      progressStep: 6,
      visibleButton: true,
    });

    participant = {
      ...participant,
      supplierOnboarding: { ...participant.supplierOnboarding, lifecycle: 'APPROVED' },
      payoutVerificationConfirmed: true,
      payoutOnboardingPhase: 'APPROVED',
    };
    expectWorkflow(participant, {
      stage: 'XERO_INVOICE',
      badge: 'Ready for Xero',
      cta: 'Push Supplier Bill to Xero',
      readiness: 'ready',
      progressStep: 7,
      visibleButton: true,
    });

    participant = {
      ...participant,
      paymentSetup: {
        ...participant.paymentSetup,
        xeroExportedAt: '2024-01-06T00:00:00Z',
        xeroSyncStatus: 'synced',
      },
    };
    expectWorkflow(participant, {
      stage: 'SETTLEMENT_READY',
      badge: 'Ready for Settlement',
      cta: 'Release Settlement',
      readiness: 'complete',
      progressStep: 8,
      visibleButton: false,
    });

    participant = {
      ...participant,
      payoutSettlementStatus: 'Paid',
      payoutPaidAt: '2024-01-07T00:00:00Z',
    };
    expectWorkflow(participant, {
      stage: 'PAID',
      badge: 'Paid',
      cta: 'Paid',
      readiness: 'complete',
      progressStep: 9,
      visibleButton: false,
    });
  });

  it('derives one mutually exclusive next action for every workflow state', () => {
    const cases: Array<{
      name: string;
      participant: DemoParticipant;
      stage: ReturnType<typeof deriveParticipantCommercialLifecycle>;
      badge: string;
      nextAction: string;
      readiness: ReturnType<typeof deriveParticipantOperationalWorkflow>['readiness'];
    }> = [
      {
        name: 'earnings not configured',
        participant: baseParticipant({ compensationProfile: undefined, commissionValue: 0 }),
        stage: 'DRAFT',
        badge: 'Configure Earnings',
        nextAction: 'Configure Earnings',
        readiness: 'blocked',
      },
      {
        name: 'agreement not sent',
        participant: baseParticipant(),
        stage: 'EARNINGS_CONFIGURED',
        badge: 'Agreement Ready',
        nextAction: 'Send Agreement',
        readiness: 'ready',
      },
      {
        name: 'agreement pending',
        participant: baseParticipant({
          inviteSentAt: '2024-01-02T00:00:00Z',
          inviteStatus: 'Invited',
        }),
        stage: 'AGREEMENT_SENT',
        badge: 'Waiting for Acceptance',
        nextAction: 'Waiting for Acceptance',
        readiness: 'waiting',
      },
      {
        name: 'agreement accepted but payout details missing',
        participant: baseParticipant({
          approvalStatus: 'Approved',
          approvedAt: '2024-01-03T00:00:00Z',
        }),
        stage: 'AGREEMENT_ACCEPTED',
        badge: 'Agreement Accepted',
        nextAction: 'Request Payout Details',
        readiness: 'ready',
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
        badge: 'Waiting for Participant',
        nextAction: 'Waiting for Participant',
        readiness: 'waiting',
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
        badge: 'Verify Payout Details',
        nextAction: 'Verify Payout Details',
        readiness: 'ready',
      },
      {
        name: 'commercial data verified and ready for Xero',
        participant: baseParticipant({
          approvalStatus: 'Approved',
          supplierOnboarding: { lifecycle: 'APPROVED' },
          payoutVerificationConfirmed: true,
        }),
        stage: 'XERO_INVOICE',
        badge: 'Ready for Xero',
        nextAction: 'Push Supplier Bill to Xero',
        readiness: 'ready',
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
        badge: 'Ready for Settlement',
        nextAction: 'Release Settlement',
        readiness: 'complete',
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
        badge: 'Paid',
        nextAction: 'Paid',
        readiness: 'complete',
      },
    ];

    for (const item of cases) {
      const stage = deriveParticipantCommercialLifecycle(item.participant);
      const workflow = deriveParticipantOperationalWorkflow(item.participant);
      const table = deriveParticipantCommercialTablePresentation(item.participant);
      expect(stage).toBe(item.stage);
      expect(workflow.stage).toBe(item.stage);
      expect(workflow.badge).toBe(item.badge);
      expect(workflow.primaryCta.label).toBe(item.nextAction);
      expect(workflow.readiness).toBe(item.readiness);
      expect(workflow.progress.currentStep).toBeGreaterThanOrEqual(1);
      expect(workflow.progress.currentStep).toBeLessThanOrEqual(workflow.progress.totalSteps);
      expect(workflow.progress.percent).toBeGreaterThan(0);
      expect(table.stage).toBe(item.stage);
      expect(table.workflow).toEqual(workflow);
      expect(table.commercialChip).toBe(item.badge);
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
    expect(table.commercialChip).toBe('Configure Earnings');
    expect(table.commercialChip).not.toMatch(/Agreement Sent/i);
  });

  it('missing email keeps participant in DRAFT with awaiting agreement commercial column', () => {
    const p = baseParticipant({ email: '' });
    expect(deriveParticipantCommercialLifecycle(p)).toBe('DRAFT');
    const table = deriveParticipantCommercialTablePresentation(p);
    expect(table.agreementChip).toBe('Draft');
    expect(table.commercialChip).toBe('Configure Earnings');
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
    expect(action.label).toBe('Push Supplier Bill to Xero');
    const table = deriveParticipantCommercialTablePresentation(p);
    expect(table.commercialChip).toBe('Ready for Xero');
    expect(table.nextAction.label).toBe('Push Supplier Bill to Xero');
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
    expect(action.label).toBe('Release Settlement');
    const table = deriveParticipantCommercialTablePresentation(p);
    expect(table.nextAction.label).toBe('Release Settlement');
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
