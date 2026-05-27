import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  deriveOperationalBlockingActions,
  isSettlementReleaseReady,
} from '@/lib/operations/explainability/derive-operational-blocking-actions';
import {
  resolveObligationAllocationLabel,
  resolvePersistedObligationStatus,
} from '@/lib/operations/derivations/derive-obligation-allocation-status';
import { deriveObligationApprovalState } from '@/lib/operations/derivations/derive-approval-state';
import { getOperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import {
  assertSettlementReleaseInvariants,
  OperationalInvariantViolation,
} from '@/lib/operations/dev/operational-invariants';
import { DealNetworkPilotObligationStatus } from '@prisma/client';

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

describe('settlement release integrity', () => {
  it('converges release guidance when funding, approval, and obligations align', () => {
    const p = readyParticipant();
    const snapshot = getOperationalCoordinationSnapshot({
      participants: [p],
      projectId: 'deal-1',
      fundingAllocated: true,
      obligationStatusByParticipant: { [p.id]: 'AVAILABLE_FOR_PAYOUT' },
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
          allocationStatus: 'AVAILABLE_FOR_PAYOUT',
          readiness: 'ready',
        },
      ],
    });

    expect(isSettlementReleaseReady(snapshot)).toBe(true);
    const blocking = deriveOperationalBlockingActions(snapshot);
    expect(blocking.readinessExplanation.headline).toBe('Ready for payout release');
    expect(blocking.blockers).toHaveLength(0);
  });

  it('still blocks release when funding is insufficient', () => {
    const p = readyParticipant();
    const snapshot = getOperationalCoordinationSnapshot({
      participants: [p],
      projectId: 'deal-1',
      fundingAllocated: true,
      obligationStatusByParticipant: { [p.id]: 'PENDING_APPROVAL' },
      funding: {
        fundingSourceConnected: true,
        confirmedFunding: 100,
        obligationsTotal: 500,
        obligationsFunded: 100,
      },
      obligations: [
        {
          id: 'obl-1',
          participantId: p.id,
          amount: 500,
          amountFunded: 100,
          allocationStatus: 'PARTIALLY_FUNDED',
          readiness: 'partially_funded',
        },
      ],
    });

    expect(isSettlementReleaseReady(snapshot)).toBe(false);
    const blocking = deriveOperationalBlockingActions(snapshot);
    expect(blocking.readinessExplanation.headline).toBe('Release blocked because:');
  });

  it('throws RELEASE_BLOCKED_WHEN_SETTLEMENT_READY in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertSettlementReleaseInvariants({
        settlementReady: true,
        releaseBlocked: true,
        releaseReadyCount: 1,
        guidanceHeadline: 'Release blocked because:',
      })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });
});

describe('obligation allocation status convergence', () => {
  it('persists APPROVED when participant is fully approved and funded', () => {
    const p = readyParticipant();
    const status = resolvePersistedObligationStatus({
      participant: p,
      deal: baseDeal(),
      moneyConfirmed: true,
      fullyFunded: false,
    });
    expect(status).toBe(DealNetworkPilotObligationStatus.APPROVED);
  });

  it('persists AVAILABLE_FOR_PAYOUT when fully approved and fully funded', () => {
    const p = readyParticipant();
    const status = resolvePersistedObligationStatus({
      participant: p,
      deal: baseDeal(),
      moneyConfirmed: true,
      fullyFunded: true,
    });
    expect(status).toBe(DealNetworkPilotObligationStatus.AVAILABLE_FOR_PAYOUT);
  });

  it('does not keep pending approval label for approved payout-ready participant', () => {
    const p = readyParticipant();
    const approval = deriveObligationApprovalState({
      obligationStatus: 'PENDING_APPROVAL',
      participant: p,
    });
    expect(approval).toBe('ready');

    const label = resolveObligationAllocationLabel({
      allocationStatus: 'PENDING_APPROVAL',
      participant: p,
    });
    expect(label).not.toMatch(/pending approval/i);
    expect(label).toBe('Ready for release');
  });

  it('throws APPROVED_PARTICIPANT_SHOWING_PENDING_APPROVAL in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertSettlementReleaseInvariants({ approvedParticipantPendingApproval: true })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });
});
