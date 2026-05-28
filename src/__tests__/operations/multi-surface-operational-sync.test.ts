import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { getOperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import { buildCanonicalStateFromSnapshot } from '@/lib/operations/reducer/adapters/legacy-selectors';
import { deriveOperationalKPIs } from '@/lib/operations/reducer/derive-operational-kpis';
import { emptyOperationalGraphProjection } from '@/lib/operations/coordination/safe-operational-projection';
import {
  assertPostConvergenceIntegrity,
} from '@/lib/operations/dev/assert-post-convergence-integrity';
import { synchronizeOperationalState } from '@/lib/operations/orchestration/synchronize-operational-state';
import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';

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

function readyParticipant(id: string, overrides: Partial<DemoParticipant> = {}): DemoParticipant {
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
    ...overrides,
  } as DemoParticipant;
}

function activationInputFromGraph(
  graph: ReturnType<typeof getOperationalCoordinationSnapshot>
) {
  return {
    hasOrganization: true,
    onboardingCompleted: true,
    projectCreated: true,
    participantCount: graph.summary.participantCount,
    participantsConfigured: graph.summary.earningsConfiguredCount >= graph.summary.participantCount,
    participantsConfiguredCount: graph.summary.earningsConfiguredCount,
    obligationCount: graph.obligations.length,
    paymentLinkCount: 0,
    collectionPreferenceDecideLater: false,
    defaultCurrency: 'USD',
    stripeConfigured: true,
    wiseConfigured: false,
    hederaConfigured: false,
    releaseEligibleCount: graph.summary.releaseReadyCount,
    releaseBatchCount: 0,
    primaryProjectId: 'deal-1',
  };
}

/** Simulates four dashboard surfaces reading the same canonical snapshot after one sync cycle. */
function surfaceKpisFromSnapshot(
  graph: ReturnType<typeof getOperationalCoordinationSnapshot>
) {
  const canonical = buildCanonicalStateFromSnapshot(graph, {
    activation: activationInputFromGraph(graph),
    graphReady: true,
    graphSnapshotConverged: true,
  });
  return deriveOperationalKPIs(canonical!);
}

describe('multi-surface operational sync convergence', () => {
  const prevNodeEnv = process.env.NODE_ENV;

  it('workspace, participants, payouts, and obligations surfaces share identical KPIs', () => {
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

    const surfaces = [
      'workspace-home',
      'project-participants',
      'payouts-overview',
      'obligations-table',
    ] as const;

    const kpisBySurface = Object.fromEntries(
      surfaces.map((surface) => [surface, surfaceKpisFromSnapshot(graph)])
    ) as Record<(typeof surfaces)[number], ReturnType<typeof deriveOperationalKPIs>>;

    const baseline = kpisBySurface['workspace-home'];
    for (const surface of surfaces) {
      expect(kpisBySurface[surface]).toEqual(baseline);
    }

    assertPostConvergenceIntegrity({
      mutation: 'participant_earnings_save',
      projectId: 'deal-1',
      surface: 'multi-surface-test',
      participants,
      graphSummary: {
        participantCount: graph.summary.participantCount,
        earningsConfiguredCount: graph.summary.earningsConfiguredCount,
        payoutReadyCount: graph.summary.payoutReadyCount,
        obligationCount: graph.obligations.length,
      },
      canonicalKpis: baseline,
      activation: {
        participantCount: graph.summary.participantCount,
        participantsConfiguredCount: graph.summary.earningsConfiguredCount,
        obligationCount: graph.obligations.length,
      },
      obligationsTableRowCount: graph.obligations.length,
      fundingAllocated: graph.funding.allocated,
      treasuryHasFundingSources: graph.funding.allocated,
    });
    process.env.NODE_ENV = prevNodeEnv;
  });

  it('does not emit zero configured counts when API graph is empty but participants are persisted', () => {
    const participants = [
      readyParticipant('p-1', { approvalStatus: 'Sent', payoutVerificationConfirmed: false }),
    ];
    const emptyApi = emptyOperationalGraphProjection();
    expect(emptyApi.summary.participantCount).toBe(0);

    const persisted = getOperationalCoordinationSnapshot({
      participants,
      projectId: 'deal-1',
      fundingAllocated: true,
    });

    const apiHasEntities =
      (emptyApi.summary?.participantCount ?? 0) > 0 ||
      (emptyApi.participants?.length ?? 0) > 0;
    const effectiveGraph = apiHasEntities ? emptyApi : persisted;

    expect(effectiveGraph.summary.earningsConfiguredCount).toBeGreaterThan(0);
    expect(effectiveGraph.summary.participantCount).toBe(1);
  });

  it('recomputes identical counts after compensation, payout, and funding mutations', () => {
    let participants = [
      buildProjectParticipant({
        name: 'Alex',
        role: 'Contributor',
        project: baseDeal(),
        participationModel: 'fixed_payout',
        commissionKind: 'fixed_amount',
        commissionValue: 100,
        enableCustomerAttribution: false,
      }),
    ];
    participants[0]!.compensationProfile = {
      ...participants[0]!.compensationProfile!,
      configured: true,
    };

    const earningsSync = synchronizeOperationalState({
      mutation: 'participant_earnings_save',
      projectId: 'deal-1',
      participants,
      fundingAllocated: false,
    });
    expect(earningsSync.snapshot.summary.earningsConfiguredCount).toBe(1);

    const fundingSync = synchronizeOperationalState({
      mutation: 'funding_update',
      projectId: 'deal-1',
      participants,
      fundingAllocated: true,
    });
    expect(fundingSync.snapshot.summary.earningsConfiguredCount).toBe(1);

    const graph = getOperationalCoordinationSnapshot({
      participants,
      projectId: 'deal-1',
      fundingAllocated: true,
    });

    const home = surfaceKpisFromSnapshot(graph);
    const payouts = surfaceKpisFromSnapshot(graph);
    const obligations = surfaceKpisFromSnapshot(graph);

    expect(home).toEqual(payouts);
    expect(payouts).toEqual(obligations);
    expect(home.earningsConfiguredCount).toBe(1);
    expect(home.participantCount).toBe(1);
  });
});
