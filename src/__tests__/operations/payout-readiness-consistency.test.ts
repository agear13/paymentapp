import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { derivePayoutReleaseReadiness } from '@/lib/operations/readiness/derive-payout-release-readiness';
import { getOperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';

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

describe('payout readiness consistency', () => {
  it('does not report release ready when agreement is unapproved', () => {
    const p = buildProjectParticipant({
      name: 'Sam',
      role: 'Contributor',
      project: baseDeal(),
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 100,
      enableCustomerAttribution: false,
    });
    p.compensationProfile = { ...p.compensationProfile!, configured: true };
    p.payoutVerificationConfirmed = true;

    const readiness = derivePayoutReleaseReadiness(p, { projectId: 'deal-1' });
    expect(readiness.releaseReady).toBe(false);
    expect(readiness.agreementApproved).toBe(false);
    expect(readiness.blockers.length).toBeGreaterThan(0);
  });

  it('coordination snapshot aligns payout and release counts', () => {
    const ready = buildProjectParticipant({
      name: 'Ready',
      role: 'Contributor',
      project: baseDeal(),
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 100,
      enableCustomerAttribution: false,
    });
    ready.compensationProfile = { ...ready.compensationProfile!, configured: true };
    ready.approvalStatus = 'Approved';
    ready.payoutVerificationConfirmed = true;

    const pending = buildProjectParticipant({
      name: 'Pending',
      role: 'Contributor',
      project: baseDeal(),
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 100,
      enableCustomerAttribution: false,
    });
    pending.compensationProfile = { ...pending.compensationProfile!, configured: true };

    const snapshot = getOperationalCoordinationSnapshot({
      participants: [ready, pending],
      projectId: 'deal-1',
      fundingAllocated: true,
    });

    expect(snapshot.summary.payoutReadyCount).toBe(1);
    expect(snapshot.summary.releaseReadyCount).toBe(1);
    expect(snapshot.summary.blockerCount).toBeGreaterThan(0);
  });
});
