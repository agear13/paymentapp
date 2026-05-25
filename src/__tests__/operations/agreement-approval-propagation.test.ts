import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import { applyCompensationProfileToParticipant } from '@/lib/participants/participant-compensation';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  deriveAgreementApprovalState,
  deriveOperationalBlocker,
} from '@/lib/operations/derivations/derive-approval-state';
import { hydrateOperationalParticipant } from '@/lib/operations/hydration/hydrate-operational-participant';
import { deriveParticipantPayoutReadiness } from '@/lib/operations/readiness/participant-readiness';
import { synchronizeOperationalStateAfterApproval } from '@/lib/operations/orchestration/synchronize-operational-state';

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

describe('agreement approval propagation', () => {
  it('persists approved state through hydration precedence', () => {
    const raw = buildProjectParticipant({
      name: 'Coastal Media',
      role: 'Partner',
      project: baseDeal(),
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 500,
      enableCustomerAttribution: false,
    });

    const approved = {
      ...raw,
      approvalStatus: 'Approved' as const,
      approvedAt: new Date().toISOString(),
    };

    const hydrated = hydrateOperationalParticipant(approved);
    expect(hydrated.approvalStatus).toBe('Approved');
    expect(hydrated.agreementLifecycle).toBe('APPROVED');
    expect(hydrated.participantLifecycle).toBe('APPROVED');
    expect(deriveAgreementApprovalState(hydrated)).toBe('participant_approved');
  });

  it('recomputes readiness and clears agreement blockers after approval sync', () => {
    const pending = buildProjectParticipant({
      name: 'Coastal Media',
      role: 'Partner',
      project: baseDeal(),
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 500,
      enableCustomerAttribution: false,
    });
    pending.compensationProfile = {
      ...pending.compensationProfile!,
      configured: true,
    };
    pending.payoutVerificationConfirmed = true;

    const approved = hydrateOperationalParticipant({
      ...pending,
      approvalStatus: 'Approved',
      approvedAt: new Date().toISOString(),
    });

    const before = deriveParticipantPayoutReadiness(pending);
    expect(before.payoutReady).toBe(false);

    const after = deriveParticipantPayoutReadiness(approved);
    expect(after.payoutReady).toBe(true);
    expect(deriveOperationalBlocker(approved, 'deal-1')).toHaveLength(0);

    const sync = synchronizeOperationalStateAfterApproval({
      projectId: 'deal-1',
      participant: approved,
      participants: [approved],
    });
    expect(sync.snapshot.summary.payoutReadyCount).toBe(1);
    expect(sync.invalidatedScopes).toContain('participant');
  });
});
