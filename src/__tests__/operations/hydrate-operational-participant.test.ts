import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  backfillOperationalParticipantState,
  hydrateOperationalParticipant,
} from '@/lib/operations/hydration/hydrate-operational-participant';
import { participantSummaryMetrics } from '@/lib/projects/participant-lifecycle';
import { deriveParticipantPayoutReadiness } from '@/lib/operations/readiness/participant-readiness';

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

describe('hydrateOperationalParticipant', () => {
  it('backfills missing lifecycle fields on draft participants', () => {
    const raw = buildProjectParticipant({
      name: 'Alex',
      role: 'Contributor',
      project: baseDeal(),
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 100,
      enableCustomerAttribution: false,
    });

    const hydrated = hydrateOperationalParticipant(raw);
    expect(hydrated.payoutVerificationConfirmed).toBe(false);
    expect(hydrated.participantLifecycle).toBe('DRAFT');
    expect(hydrated.agreementLifecycle).toBe('NOT_CREATED');
    expect(hydrated.compensationProfile?.customerAttributionEnabled).toBe(false);
    expect(hydrated.compensationProfile?.commissionSourceMode).toBe('all_active');
    expect(hydrated.compensationProfile?.commissionServiceIds).toEqual([]);
  });

  it('handles null participant without throwing', () => {
    const hydrated = hydrateOperationalParticipant(null);
    expect(hydrated.id).toBeTruthy();
    expect(hydrated.payoutVerificationConfirmed).toBe(false);
  });

  it('KPI derivation tolerates legacy draft participants', () => {
    const legacy = {
      id: 'legacy-1',
      name: 'Legacy',
      email: '',
      role: 'Contributor' as const,
      commissionKind: 'fixed_amount' as const,
      commissionValue: 0,
      status: 'Pending' as const,
      approvalStatus: 'Pending approval' as const,
      inviteToken: 'tok',
    };
    const metrics = participantSummaryMetrics([legacy as never]);
    expect(metrics.total).toBe(1);
    expect(metrics.pendingAgreements).toBeGreaterThanOrEqual(0);
  });

  it('readiness derivation does not throw on incomplete participant', () => {
    const legacy = backfillOperationalParticipantState({
      id: 'legacy-2',
      name: 'Sam',
      email: '',
      role: 'Contributor',
      commissionKind: 'fixed_amount',
      commissionValue: 0,
      status: 'Pending',
      approvalStatus: 'Pending approval',
      inviteToken: 'tok2',
    });
    expect(() => deriveParticipantPayoutReadiness(legacy)).not.toThrow();
  });
});
