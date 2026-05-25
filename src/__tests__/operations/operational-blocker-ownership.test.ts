import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { deriveOperationalBlocker } from '@/lib/operations/derivations/derive-approval-state';

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
    p.compensationProfile = { ...p.compensationProfile!, configured: true };
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

  it('names operator as owner for payout confirmation blockers', () => {
    const p = buildProjectParticipant({
      name: 'Coastal Media',
      role: 'Partner',
      project: baseDeal(),
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 500,
      enableCustomerAttribution: false,
    });
    p.compensationProfile = { ...p.compensationProfile!, configured: true };
    p.approvalStatus = 'Approved';
    p.payoutVerificationConfirmed = false;

    const blockers = deriveOperationalBlocker(p, 'deal-1');
    expect(blockers.some((b) => b.owner === 'operator' && b.requiredAction.includes('payout'))).toBe(
      true
    );
  });
});
