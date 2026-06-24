/**
 * Participant Commercial Lifecycle — regression tests
 */

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  deriveParticipantCommercialLifecycle,
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
    expect(action.label).toBe('Generate agreement');
  });

  it('sent agreement awaiting acceptance is AGREEMENT_SENT', () => {
    const p = baseParticipant({
      inviteSentAt: '2024-01-02T00:00:00Z',
      inviteStatus: 'Invited',
    });
    expect(deriveParticipantCommercialLifecycle(p)).toBe('AGREEMENT_SENT');
    expect(shouldRequestPayoutDetails(p)).toBe(false);
  });

  it('approved agreement without onboarding is AGREEMENT_ACCEPTED', () => {
    const p = baseParticipant({
      approvalStatus: 'Approved',
      approvedAt: '2024-01-03T00:00:00Z',
    });
    expect(deriveParticipantCommercialLifecycle(p)).toBe('AGREEMENT_ACCEPTED');
    expect(shouldRequestPayoutDetails(p)).toBe(true);
  });

  it('submitted onboarding requires operator review', () => {
    const p = baseParticipant({
      approvalStatus: 'Approved',
      approvedAt: '2024-01-03T00:00:00Z',
      supplierOnboarding: {
        lifecycle: 'SUBMITTED',
        submission: { submittedAt: '2024-01-04T00:00:00Z', declarationAccepted: true },
      },
    });
    expect(deriveParticipantCommercialLifecycle(p)).toBe('OPERATOR_REVIEW');
    const action = deriveParticipantLifecycleAction(p);
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
  });

  it('xero export completes lifecycle', () => {
    const p = baseParticipant({
      approvalStatus: 'Approved',
      supplierOnboarding: { lifecycle: 'APPROVED' },
      paymentSetup: {
        xeroExportedAt: '2024-01-05T00:00:00Z',
        xeroSyncStatus: 'synced',
      },
    });
    expect(deriveParticipantCommercialLifecycle(p)).toBe('SETTLEMENT_READY');
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
    expect(summary.byStage.OPERATOR_REVIEW).toBe(1);
  });

  it('never flags payout details before agreement acceptance in workspace notifications', () => {
    const summary = deriveWorkspaceLifecycleSummary([
      baseParticipant({ id: 'a' }),
      baseParticipant({ id: 'b', inviteSentAt: '2024-01-01' }),
    ]);
    const messages = summary.notifications.map((n) => n.message).join(' ');
    expect(messages).not.toMatch(/payout details/i);
    expect(messages).toMatch(/earnings configuration|ready to send|awaiting participant acceptance/i);
  });
});
