import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { getOperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import { deriveReleaseBatchEligibility } from '@/lib/operations/selectors/derive-release-batch-eligibility';
import {
  filterPilotReleaseBatchLines,
  filterReleaseBatchEligibility,
  scopeReleaseBatchToParticipants,
} from '@/lib/operations/payouts/scope-release-batch-participants';
import type { PilotReleaseBatchLine } from '@/lib/operations/orchestration/pilot-release-batch.server';

function baseDeal(): RecentDeal {
  return {
    id: 'deal-release',
    dealName: 'Release Test',
    partner: 'Venue',
    value: 10_000,
    introducer: '',
    closer: '',
    status: 'Approved',
    lastUpdated: new Date().toISOString(),
    paymentStatus: 'Paid',
    projectValueCurrency: 'AUD',
  } as RecentDeal;
}

function releaseReadyParticipant(name: string, id: string, amount: number) {
  const p = buildProjectParticipant({
    name,
    role: 'Contributor',
    project: baseDeal(),
    participationModel: 'fixed_payout',
    commissionKind: 'fixed_amount',
    commissionValue: amount,
    enableCustomerAttribution: false,
  });
  p.id = id;
  p.approvalStatus = 'Approved';
  p.payoutVerificationConfirmed = true;
  p.compensationProfile = { ...p.compensationProfile!, configured: true };
  return p;
}

function graphForParticipants(
  participants: ReturnType<typeof releaseReadyParticipant>[],
  obligations: Array<{
    id: string;
    participantId: string;
    amount: number;
  }>
) {
  return getOperationalCoordinationSnapshot({
    participants,
    projectId: baseDeal().id,
    fundingAllocated: true,
    funding: {
      fundingSourceConnected: true,
      confirmedFunding: 10_000,
      obligationsTotal: 10_000,
      obligationsFunded: 10_000,
    },
    obligations: obligations.map((o) => ({
      id: o.id,
      participantId: o.participantId,
      amount: o.amount,
      amountFunded: o.amount,
      currency: 'AUD',
      readiness: 'ready' as const,
    })),
  });
}

describe('participant release batch — scoped inclusion', () => {
  const promoter = releaseReadyParticipant('Promoter', 'p-promoter', 500);
  const dj = releaseReadyParticipant('DJ', 'p-dj', 400);

  const snapshot = graphForParticipants([promoter, dj], [
    { id: 'obl-1', participantId: 'p-promoter', amount: 500 },
    { id: 'obl-2', participantId: 'p-dj', amount: 400 },
  ]);

  const fullEligibility = deriveReleaseBatchEligibility(snapshot, {
    currency: 'AUD',
    minThreshold: 0,
  });

  it('1. single participant release scopes eligibility to one payee', () => {
    expect(fullEligibility.participantCount).toBe(2);
    const scoped = scopeReleaseBatchToParticipants(fullEligibility, ['p-promoter']);
    expect(scoped.ok).toBe(true);
    if (!scoped.ok) return;
    expect(scoped.scopedEligibility.participantCount).toBe(1);
    expect(scoped.scopedEligibility.eligibleParticipants[0]?.participantId).toBe('p-promoter');
    expect(scoped.scopedEligibility.total).toBe(500);
  });

  it('2. batch release unchanged when participantIds omitted', () => {
    const scoped = scopeReleaseBatchToParticipants(fullEligibility, undefined);
    expect(scoped.ok).toBe(true);
    if (!scoped.ok) return;
    expect(scoped.scopedEligibility.participantCount).toBe(2);
    expect(scoped.scopedEligibility.total).toBe(900);
  });

  it('3. partial release leaves other eligible participants in full eligibility', () => {
    const scoped = filterReleaseBatchEligibility(fullEligibility, ['p-promoter']);
    expect(scoped.participantCount).toBe(1);
    expect(fullEligibility.participantCount).toBe(2);
    const remaining = fullEligibility.eligibleParticipants.filter(
      (p) => !scoped.eligibleParticipants.some((s) => s.participantId === p.participantId)
    );
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.participantId).toBe('p-dj');
  });

  it('4. participant not eligible is rejected', () => {
    const scoped = scopeReleaseBatchToParticipants(fullEligibility, ['p-unknown']);
    expect(scoped.ok).toBe(false);
    if (scoped.ok) return;
    expect(scoped.error).toBe('Participant not release-eligible');
  });

  it('5. duplicate release prevention — no lines when participant not in eligible set', () => {
    const notReady = releaseReadyParticipant('Photographer', 'p-photo', 200);
    notReady.payoutVerificationConfirmed = false;
    const snap = graphForParticipants([promoter, notReady], [
      { id: 'obl-1', participantId: 'p-promoter', amount: 500 },
    ]);
    const eligibility = deriveReleaseBatchEligibility(snap, { currency: 'AUD', minThreshold: 0 });
    const scoped = scopeReleaseBatchToParticipants(eligibility, ['p-photo']);
    expect(scoped.ok).toBe(false);
  });

  it('6. ledger path participant filtering via pilot line filter', () => {
    const lines: PilotReleaseBatchLine[] = [
      {
        obligationId: 'o1',
        participantId: 'p-promoter',
        participantName: 'Promoter',
        amount: 500,
        currency: 'AUD',
      },
      {
        obligationId: 'o2',
        participantId: 'p-dj',
        participantName: 'DJ',
        amount: 400,
        currency: 'AUD',
      },
    ];
    const filtered = filterPilotReleaseBatchLines(lines, ['p-promoter']);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.participantId).toBe('p-promoter');
    expect(filterPilotReleaseBatchLines(lines, undefined)).toHaveLength(2);
  });
});
