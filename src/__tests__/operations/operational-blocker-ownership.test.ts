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

  it('names operator as owner for payment setup blockers', () => {
    // Post-approval gate is payment setup (bank details, ABN, GST) — operator-owned.
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
    const paymentSetupBlocker = blockers.find(
      (b) => b.owner === 'operator' && b.requiredAction.toLowerCase().includes('payment setup')
    );
    expect(paymentSetupBlocker).toBeDefined();
    expect(paymentSetupBlocker?.owner).toBe('operator');
    expect(paymentSetupBlocker?.requiredAction).toBe('Complete payment setup');
    expect(paymentSetupBlocker?.ctaLabel).toBe('Prepare for payment');
  });
});
