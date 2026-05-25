import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import { buildOnboardingParticipant } from '@/lib/onboarding/build-onboarding-project';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  applyParticipantAgreementGenerated,
  applyParticipantAgreementShared,
  deriveParticipantLifecycleState,
} from '@/lib/operations/lifecycle/participant-lifecycle';
import { deriveAgreementLifecycleState } from '@/lib/operations/lifecycle/agreement-lifecycle';
import {
  canGenerateAttributionLink,
  isParticipantActuallyInvited,
} from '@/lib/operations/truth';
import { deriveInviteState } from '@/lib/projects/participant-lifecycle';
import { recalculateOperationalFundingState } from '@/lib/operations/lifecycle/funding-lifecycle';
import { applyCompensationProfileToParticipant } from '@/lib/participants/participant-compensation';

function baseDeal(): RecentDeal {
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
  } as RecentDeal;
}

describe('coordination integrity', () => {
  it('participant creation does NOT imply invite sent', () => {
    const p = buildProjectParticipant({
      name: 'Alex',
      email: 'alex@test.com',
      role: 'Contributor',
      project: baseDeal(),
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 100,
      enableCustomerAttribution: false,
    });
    expect(deriveParticipantLifecycleState(p)).toBe('DRAFT');
    expect(deriveAgreementLifecycleState(p)).toBe('NOT_CREATED');
    expect(isParticipantActuallyInvited(p)).toBe(false);
    expect(deriveInviteState(p)).toBe('draft');
  });

  it('onboarding participant starts as DRAFT not invite sent', () => {
    const deal = baseDeal();
    const p = buildOnboardingParticipant({ name: 'Sam', role: 'Partner', deal });
    expect(deriveInviteState(p)).not.toBe('sent');
    expect(isParticipantActuallyInvited(p)).toBe(false);
  });

  it('agreement generation does NOT imply shared', () => {
    const p = buildProjectParticipant({
      name: 'Alex',
      email: 'alex@test.com',
      role: 'Contributor',
      project: baseDeal(),
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 100,
      enableCustomerAttribution: false,
    });
    const generated = applyParticipantAgreementGenerated(p, '/deal-invites/token');
    expect(deriveParticipantLifecycleState(generated)).toBe('INVITE_GENERATED');
    expect(isParticipantActuallyInvited(generated)).toBe(false);
  });

  it('share/copy action transitions invite state', () => {
    const generated = applyParticipantAgreementGenerated(
      buildProjectParticipant({
        name: 'Alex',
        role: 'Contributor',
        project: baseDeal(),
        participationModel: 'fixed_payout',
        commissionKind: 'fixed_amount',
        commissionValue: 100,
        enableCustomerAttribution: false,
      }),
      '/deal-invites/token'
    );
    const shared = applyParticipantAgreementShared(generated);
    expect(deriveParticipantLifecycleState(shared)).toBe('INVITE_SENT');
    expect(isParticipantActuallyInvited(shared)).toBe(true);
    expect(deriveInviteState(shared)).toBe('sent');
  });

  it('attribution disabled participants do NOT get links', () => {
    const p = buildProjectParticipant({
      name: 'Alex',
      role: 'Contributor',
      project: baseDeal(),
      participationModel: 'revenue_share',
      commissionKind: 'pct_deal_value',
      commissionValue: 10,
      enableCustomerAttribution: false,
    });
    expect(canGenerateAttributionLink(p)).toBe(false);
  });

  it('attribution enabled only when compensation explicitly enables it', () => {
    const p = buildProjectParticipant({
      name: 'Venue',
      role: 'Partner',
      project: baseDeal(),
      participationModel: 'customer_attribution',
      commissionKind: 'pct_deal_value',
      commissionValue: 10,
      enableCustomerAttribution: true,
    });
    expect(canGenerateAttributionLink(p)).toBe(false);
    const configured = applyCompensationProfileToParticipant(p, {
      compensationType: 'COMMISSION',
      percentage: 10,
      configured: true,
      revenueSources: [],
      customerAttributionEnabled: true,
      commissionSourceMode: 'selected',
      commissionServiceIds: ['svc-1'],
    });
    expect(canGenerateAttributionLink(configured, {
      catalogItems: [{ id: 'svc-1', name: 'Early Bird Tickets' }],
    })).toBe(true);
  });

  it('funding updates obligations via recalculateOperationalFundingState', () => {
    const unfunded = recalculateOperationalFundingState({
      fundingSources: [],
      obligationsTotal: 5000,
    });
    expect(unfunded.obligationsUnfunded).toBe(5000);

    const funded = recalculateOperationalFundingState({
      fundingSources: [
        {
          id: 'fs1',
          projectId: 'deal-1',
          label: 'Invoice',
          amount: 5000,
          currency: 'USD',
          status: 'confirmed',
          sourceType: 'invoice',
          createdAt: new Date().toISOString(),
        },
      ],
      obligationsTotal: 5000,
    });
    expect(funded.obligationsFunded).toBe(5000);
    expect(funded.obligationsUnfunded).toBe(0);
    expect(funded.fundingState).toBe('ALLOCATED');
  });

  it('draft participants never show approved invite state', () => {
    const p = buildProjectParticipant({
      name: 'Alex',
      role: 'Contributor',
      project: baseDeal(),
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 100,
      enableCustomerAttribution: false,
    });
    expect(deriveInviteState(p)).not.toBe('approved');
  });

  it('payout onboarding placeholder states behave safely', () => {
    const p = buildProjectParticipant({
      name: 'Alex',
      role: 'Contributor',
      project: baseDeal(),
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 100,
      enableCustomerAttribution: false,
    });
    expect(p.payoutOnboardingPhase).toBe('NOT_STARTED');
  });
});
