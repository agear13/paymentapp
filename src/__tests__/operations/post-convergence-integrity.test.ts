import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  assertPostConvergenceIntegrity,
} from '@/lib/operations/dev/assert-post-convergence-integrity';
import { OperationalInvariantViolation } from '@/lib/operations/dev/operational-invariants';
import { getOperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import { buildCanonicalStateFromSnapshot } from '@/lib/operations/reducer/adapters/legacy-selectors';
import { deriveOperationalKPIs } from '@/lib/operations/reducer/derive-operational-kpis';

function readyParticipant(id: string): DemoParticipant {
  return {
    id,
    name: `Participant ${id}`,
    email: `${id}@example.com`,
    role: 'Contributor',
    commissionKind: 'fixed_amount',
    commissionValue: 2500,
    status: 'Active',
    approvalStatus: 'Approved',
    inviteToken: 'token',
    workspaceSource: 'project',
    operationalStatus: 'active',
    payoutVerificationConfirmed: true,
    compensationProfile: {
      compensationType: 'FIXED_FEE',
      fixedAmount: 2500,
      configured: true,
      revenueSources: [],
      customerAttributionEnabled: false,
      commissionSourceMode: 'all_active',
      commissionServiceIds: [],
    },
  } as DemoParticipant;
}

describe('post-convergence integrity assertions', () => {
  const prevNodeEnv = process.env.NODE_ENV;

  it('passes when coordination snapshot, canonical KPIs, and rows align', () => {
    const participants = [
      readyParticipant('p-1', { approvalStatus: 'Sent', payoutVerificationConfirmed: false }),
      readyParticipant('p-2', { approvalStatus: 'Sent', payoutVerificationConfirmed: false }),
    ];
    const graph = getOperationalCoordinationSnapshot({
      participants,
      projectId: 'deal-1',
      fundingAllocated: true,
    });
    process.env.NODE_ENV = 'development';
    const canonical = buildCanonicalStateFromSnapshot(graph, {
      activation: {
        hasOrganization: true,
        onboardingCompleted: true,
        projectCreated: true,
        participantCount: 2,
        participantsConfigured: true,
        participantsConfiguredCount: 2,
        obligationCount: 0,
        paymentLinkCount: 0,
        collectionPreferenceDecideLater: false,
        defaultCurrency: 'USD',
        stripeConfigured: true,
        wiseConfigured: false,
        hederaConfigured: false,
        releaseEligibleCount: graph.summary.releaseReadyCount,
        releaseBatchCount: 0,
        primaryProjectId: 'deal-1',
      },
      graphReady: true,
      graphSnapshotConverged: true,
    });
    const kpis = deriveOperationalKPIs(canonical!);
    const obligationCount = kpis.obligationCount;

    expect(() =>
      assertPostConvergenceIntegrity({
        mutation: 'participant_earnings_save',
        projectId: 'deal-1',
        participants,
        graphSummary: {
          participantCount: graph.summary.participantCount,
          earningsConfiguredCount: graph.summary.earningsConfiguredCount,
          payoutReadyCount: graph.summary.payoutReadyCount,
          obligationCount,
        },
        canonicalKpis: kpis,
        activation: {
          participantCount: 2,
          participantsConfiguredCount: 2,
          obligationCount,
        },
        sync: {
          payoutReadyCount: graph.summary.payoutReadyCount,
          obligationCount,
        },
        obligationsTableRowCount: obligationCount,
      })
    ).not.toThrow();
    process.env.NODE_ENV = prevNodeEnv;
  });

  it('throws when canonical KPIs diverge from persisted rows', () => {
    const participants = [
      readyParticipant('p-1', {
        approvalStatus: 'Sent',
        payoutVerificationConfirmed: false,
        compensationProfile: {
          compensationType: 'FIXED_FEE',
          fixedAmount: 0,
          configured: false,
          revenueSources: [],
          customerAttributionEnabled: false,
          commissionSourceMode: 'all_active',
          commissionServiceIds: [],
        },
      }),
    ];
    process.env.NODE_ENV = 'test';
    const graph = getOperationalCoordinationSnapshot({
      participants,
      projectId: 'deal-1',
      fundingAllocated: true,
    });
    process.env.NODE_ENV = 'development';

    expect(() =>
      assertPostConvergenceIntegrity({
        mutation: 'payout_verification',
        participants,
        graphSummary: {
          participantCount: graph.summary.participantCount,
          earningsConfiguredCount: graph.summary.earningsConfiguredCount,
          payoutReadyCount: graph.summary.payoutReadyCount,
          obligationCount: graph.obligations.length,
        },
        canonicalKpis: {
          participantCount: 1,
          earningsConfiguredCount: 99,
          payoutReadyCount: 0,
          approvedAgreementCount: 0,
          fundedObligationCount: 0,
          releaseEligibleCount: 0,
          attributionActiveCount: 0,
          obligationCount: 0,
          participantsConfigured: false,
        },
      })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prevNodeEnv;
  });

  it('no-ops outside development', () => {
    process.env.NODE_ENV = 'production';
    expect(() =>
      assertPostConvergenceIntegrity({
        mutation: 'funding_update',
        participants: [],
        graphSummary: { participantCount: 1, earningsConfiguredCount: 0, payoutReadyCount: 0 },
        canonicalKpis: null,
      })
    ).not.toThrow();
  });
});
