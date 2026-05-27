import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { deriveOperationalBlockingActions } from '@/lib/operations/explainability/derive-operational-blocking-actions';
import { deriveOperationalReleaseBlockers } from '@/lib/operations/explainability/derive-operational-release-blockers';
import {
  deriveParticipantEarningsBucket,
  groupParticipantEarningsByBucket,
} from '@/lib/operations/selectors/derive-participant-earnings-buckets';
import { getOperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import {
  assertPayoutExplainabilityInvariants,
  OperationalInvariantViolation,
} from '@/lib/operations/dev/operational-invariants';

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

function readyParticipant() {
  const p = buildProjectParticipant({
    name: 'Alex',
    role: 'Contributor',
    project: baseDeal(),
    participationModel: 'fixed_payout',
    commissionKind: 'fixed_amount',
    commissionValue: 500,
    enableCustomerAttribution: false,
  });
  p.approvalStatus = 'Approved';
  p.payoutVerificationConfirmed = true;
  p.compensationProfile = { ...p.compensationProfile!, configured: true };
  return p;
}

describe('payout explainability integrity', () => {
  it('explains graph initialization without implying missing approvals', () => {
    const blockers = deriveOperationalReleaseBlockers({
      snapshot: {
        participants: [],
        obligations: [],
        summary: {
          participantCount: 0,
          payoutReadyCount: 0,
          releaseReadyCount: 0,
          blockerCount: 0,
          allBlockers: [],
        },
        funding: { allocated: false, stage: null },
      },
      graphReady: false,
      initializationRecoveryMessage:
        'Settlement graph initialization is incomplete. Funding and participant approvals are already satisfied.',
    });

    expect(blockers).toHaveLength(1);
    expect(blockers[0]?.category).toBe('operational_graph_initializing');
    expect(blockers[0]?.operatorActionRequired).toBe(false);
    expect(blockers[0]?.reason).toMatch(/initialization/i);
    expect(blockers[0]?.remediation).toMatch(/refresh|resume|initialization/i);
  });

  it('detects stale obligation sync instead of missing approvals', () => {
    const p = readyParticipant();
    const snapshot = getOperationalCoordinationSnapshot({
      participants: [p],
      projectId: 'deal-1',
      fundingAllocated: true,
      obligationStatusByParticipant: { [p.id]: 'PENDING_APPROVAL' },
      funding: {
        fundingSourceConnected: true,
        confirmedFunding: 500,
        obligationsTotal: 500,
        obligationsFunded: 500,
      },
      obligations: [
        {
          id: 'obl-1',
          participantId: p.id,
          amount: 500,
          amountFunded: 500,
          allocationStatus: 'PENDING_APPROVAL',
          readiness: 'ready',
        },
      ],
    });

    const blocking = deriveOperationalBlockingActions(snapshot);
    expect(
      blocking.detailedBlockers.some((b) => b.category === 'obligation_sync_pending')
    ).toBe(true);
    expect(
      blocking.detailedBlockers.some((b) => b.category === 'participant_approval_missing')
    ).toBe(false);
    expect(blocking.detailedBlockers[0]?.ctaLabel).toMatch(/refresh/i);
  });

  it('throws GENERIC_RELEASE_BLOCKER_WITHOUT_EXPLANATION in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertPayoutExplainabilityInvariants({
        detailedBlockers: [{ reason: '', remediation: 'Do something' }],
      })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });
});

describe('participant earnings bucket integrity', () => {
  it('does not label approved payout-ready earnings as needs funding', () => {
    const p = readyParticipant();
    const bucket = deriveParticipantEarningsBucket({
      id: 'obl-1',
      status: 'PENDING_APPROVAL',
      participant: p,
      amountOwed: 500,
      amountFunded: 500,
    });
    expect(bucket).toBe('awaiting_orchestration_refresh');
    expect(bucket).not.toBe('needs_funding');
  });

  it('places fully converged obligations in ready for release', () => {
    const p = readyParticipant();
    const bucket = deriveParticipantEarningsBucket({
      id: 'obl-2',
      status: 'AVAILABLE_FOR_PAYOUT',
      participant: p,
      amountOwed: 500,
      amountFunded: 500,
    });
    expect(bucket).toBe('ready_for_release');
  });

  it('groups stale approved rows out of needs funding bucket', () => {
    const p = readyParticipant();
    const grouped = groupParticipantEarningsByBucket([
      { id: '1', status: 'PENDING_APPROVAL', participant: p, amountOwed: 500 },
      { id: '2', status: 'UNFUNDED', participant: p, amountOwed: 500 },
    ]);
    expect(grouped.needs_funding).toHaveLength(0);
    expect(grouped.awaiting_orchestration_refresh.length).toBeGreaterThan(0);
    expect(grouped.ready_for_release).toHaveLength(0);
  });
});
