import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  deriveAgreementOrganiserStatus,
  deriveParticipantWorkspaceOnboarding,
  derivePayoutDetailsOrganiserStatus,
} from '@/lib/participant-portal/participant-workspace-onboarding';

const baseParticipant: DemoParticipant = {
  id: 'p-1',
  name: 'Alex Supplier',
  email: 'alex@example.com',
  role: 'Contributor',
  inviteToken: 'invite-1',
  commissionKind: 'fixed_amount',
  commissionValue: 500,
  compensationProfile: {
    compensationType: 'FIXED_FEE',
    fixedAmount: 500,
    configured: true,
    configuredAt: '2026-06-27T09:00:00.000Z',
    revenueSources: [],
    customerAttributionEnabled: false,
    commissionSourceMode: 'all_active',
    commissionServiceIds: [],
  },
};

describe('deriveParticipantWorkspaceOnboarding', () => {
  it('routes to agreement review when agreement is shared but not approved', () => {
    const participant = {
      ...baseParticipant,
      agreementSharedAt: '2026-06-28T00:00:00.000Z',
    };
    const onboarding = deriveParticipantWorkspaceOnboarding(participant);
    expect(onboarding.step).toBe('agreement_review');
    expect(onboarding.agreementStatus).toBe('Pending');
    expect(onboarding.nextRequiredAction).toMatch(/approve/i);
  });

  it('routes to payout details after agreement approval when payout is outstanding', () => {
    const participant = {
      ...baseParticipant,
      approvalStatus: 'Approved' as const,
      approvedAt: '2026-06-28T10:00:00.000Z',
      paymentSetup: {
        token: 'pay-token',
        tokenExpiresAt: '2027-01-01T00:00:00.000Z',
        paymentRequestGeneratedAt: '2026-06-28T11:00:00.000Z',
      },
    };
    const onboarding = deriveParticipantWorkspaceOnboarding(participant);
    expect(onboarding.step).toBe('payout_details');
    expect(onboarding.agreementStatus).toBe('Approved');
    expect(onboarding.payoutDetailsStatus).toBe('Pending');
  });

  it('forces payout step when ?step=payout is present', () => {
    const participant = {
      ...baseParticipant,
      approvalStatus: 'Approved' as const,
      approvedAt: '2026-06-28T10:00:00.000Z',
    };
    const onboarding = deriveParticipantWorkspaceOnboarding(participant, { urlStep: 'payout' });
    expect(onboarding.step).toBe('payout_details');
  });

  it('marks onboarding complete when payout is verified', () => {
    const participant = {
      ...baseParticipant,
      approvalStatus: 'Approved' as const,
      approvedAt: '2026-06-28T10:00:00.000Z',
      payoutVerificationConfirmed: true,
      supplierOnboarding: {
        lifecycle: 'APPROVED',
        events: [],
      },
    };
    const onboarding = deriveParticipantWorkspaceOnboarding(participant);
    expect(onboarding.step).toBe('complete');
    expect(onboarding.onboardingComplete).toBe(true);
    expect(onboarding.nextRequiredAction).toBeNull();
  });

  it('shows payout submitted as complete onboarding with no next action', () => {
    const participant = {
      ...baseParticipant,
      approvalStatus: 'Approved' as const,
      approvedAt: '2026-06-28T10:00:00.000Z',
      supplierOnboarding: {
        lifecycle: 'SUBMITTED',
        events: [],
        submission: { submittedAt: '2026-06-29T00:00:00.000Z' },
      },
    };
    const onboarding = deriveParticipantWorkspaceOnboarding(participant);
    expect(onboarding.step).toBe('payout_submitted');
    expect(derivePayoutDetailsOrganiserStatus(participant)).toBe('Submitted');
    expect(deriveAgreementOrganiserStatus(participant)).toBe('Approved');
  });
});
