import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import { deriveOperationalBlocker } from '@/lib/operations/derivations/derive-approval-state';

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

describe('operational blocker ownership', () => {
  it('names participant as owner for shared agreement blockers', () => {
    const p = buildProjectParticipant({
      name: 'Coastal Media',
      role: 'Partner',
      project: baseDeal(),
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 500,
      enableCustomerAttribution: false,
    });
    p.compensationProfile = { ...(p.compensationProfile || {}), configured: true };
    p.agreementSharedAt = new Date().toISOString();
    p.agreementLifecycle = 'SHARED';

    const blockers = deriveOperationalBlocker(p, 'deal-1');
    const agreementBlocker = blockers.find((b) => b.requiredAction.includes('Approve participation'));
    expect(agreementBlocker).toBeDefined();
    expect(agreementBlocker?.owner).toBe('participant');
    expect(agreementBlocker?.ownerLabel).toBe('Coastal Media');
    expect(agreementBlocker?.explanation).toContain('Coastal Media');
    expect(agreementBlocker?.unlocks).toContain('payout-ready');
  });

  it('names operator as owner for supplier onboarding blockers', () => {
    // Sprint 7.2: the post-approval gate is supplier onboarding (not payout confirmation).
    // The blocker owner is still 'operator', but requiredAction is now 'Complete supplier onboarding'.
    const p = buildProjectParticipant({
      name: 'Coastal Media',
      role: 'Partner',
      project: baseDeal(),
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 500,
      enableCustomerAttribution: false,
    });
    p.compensationProfile = { ...(p.compensationProfile || {}), configured: true };
    p.approvalStatus = 'Approved';
    p.payoutVerificationConfirmed = false;

    const blockers = deriveOperationalBlocker(p, 'deal-1');
    // Owner is operator — the operator is responsible for collecting onboarding details.
    // requiredAction reflects the canonical supplier onboarding workflow.
    const onboardingBlocker = blockers.find(
      (b) => b.owner === 'operator' && b.requiredAction.toLowerCase().includes('onboarding')
    );
    expect(onboardingBlocker).toBeDefined();
    expect(onboardingBlocker?.owner).toBe('operator');
  });
});
