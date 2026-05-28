import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { getOperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import {
  activationFromOperationalGraph,
  workspaceContextFromGraph,
} from '@/lib/operations/selectors/operational-graph-adapter';
import { reduceOperationalState } from '@/lib/operations/reducer/reduce-operational-state';
import { deriveOperationalKPIs } from '@/lib/operations/reducer/derive-operational-kpis';
import { deriveCanonicalOperationalBlockers } from '@/lib/operations/reducer/derive-canonical-operational-blockers';
import { deriveAttributionServiceScopeFromState } from '@/lib/operations/reducer/derive-attribution-service-scope-from-state';
import { deriveOperationalObligationsFromState } from '@/lib/operations/reducer/derive-operational-obligations-from-state';
import type { OperationalEvent } from '@/lib/operations/contracts/operational-events';
import {
  assertCanonicalConvergenceInvariants,
  assertMultipleOperationalTruthSources,
  assertPersistedEntityDominanceInvariants,
  OperationalInvariantViolation,
} from '@/lib/operations/dev/operational-invariants';
import { buildPersistedCoordinationSnapshot } from '@/lib/operations/selectors/build-persisted-coordination-snapshot';
import { buildCanonicalStateFromSnapshot } from '@/lib/operations/reducer/adapters/legacy-selectors';

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

function commissionEvent(participantId: string): OperationalEvent {
  return {
    type: 'PARTICIPANT_COMPENSATION_UPDATED',
    participantId,
    timestamp: '2026-05-20T10:00:00.000Z',
    source: 'server',
  };
}

describe('operational convergence architecture', () => {
  it('replays events deterministically with alias normalization', () => {
    const events: OperationalEvent[] = [
      {
        type: 'participant_compensation_configured' as OperationalEvent['type'],
        participantId: 'p-1',
        timestamp: '2026-05-20T10:00:00.000Z',
        source: 'server',
      },
      commissionEvent('p-1'),
    ];

    const state = reduceOperationalState({
      events,
      seed: { participants: [readyParticipant('p-1')] },
    });

    expect(state.events.length).toBe(1);
    expect(state.events[0]?.type).toBe('PARTICIPANT_COMPENSATION_UPDATED');
    expect(state.replayFingerprint).toBeTruthy();
  });

  it('materializes obligations when compensation, agreement, payout, and funding converge', () => {
    const participants = [readyParticipant('p-1'), readyParticipant('p-2')];
    const state = reduceOperationalState({
      events: [
        commissionEvent('p-1'),
        commissionEvent('p-2'),
        {
          type: 'AGREEMENT_APPROVED',
          participantId: 'p-1',
          timestamp: '2026-05-20T11:00:00.000Z',
          source: 'server',
        },
        {
          type: 'FUNDING_ALLOCATION_RESERVED',
          timestamp: '2026-05-20T12:00:00.000Z',
          source: 'server',
        },
      ],
      seed: {
        participants,
        fundingAllocated: true,
        graphReady: true,
        graphSnapshotConverged: true,
      },
    });

    const materialized = state.obligations.filter((o) => o.materialized);
    expect(materialized.length).toBeGreaterThan(0);
    expect(deriveOperationalKPIs(state).obligationCount).toBe(state.obligations.length);
  });

  it('keeps KPI counts, activation, and workspace context aligned through canonical reducer', () => {
    const participants = [readyParticipant('p-1'), readyParticipant('p-2')];
    const snapshot = getOperationalCoordinationSnapshot({
      participants,
      fundingAllocated: true,
    });

    const activationInput = {
      hasOrganization: true,
      onboardingCompleted: true,
      projectCreated: true,
      participantCount: 2,
      participantsConfigured: false,
      participantsConfiguredCount: 0,
      paymentLinkCount: 0,
      collectionPreferenceDecideLater: false,
      defaultCurrency: 'USD',
      stripeConfigured: true,
      wiseConfigured: false,
      hederaConfigured: false,
      releaseBatchCount: 0,
      primaryProjectId: 'proj-1',
    };

    const workspace = workspaceContextFromGraph(snapshot, activationInput);
    const activation = activationFromOperationalGraph(snapshot, activationInput);

    expect(workspace.participantsConfiguredCount).toBe(2);
    expect(workspace.participantCount).toBe(2);
    expect(activation.participantsConfiguredCount).toBe(2);
    expect(activation.participantsConfigured).toBe(true);

    assertMultipleOperationalTruthSources({
      canonicalKpis: workspace.participantsConfiguredCount,
      parallelKpiDerivation: activation.participantsConfiguredCount,
    });
  });

  it('deduplicates release blockers from single blocker engine', () => {
    const state = reduceOperationalState({
      seed: {
        participants: [readyParticipant('p-1')],
        fundingAllocated: true,
        graphReady: true,
        graphSnapshotConverged: true,
      },
    });

    const blockers = deriveCanonicalOperationalBlockers(state);
    const fingerprints = blockers.map((b) => b.fingerprint);
    expect(new Set(fingerprints).size).toBe(fingerprints.length);
  });

  it('derives attribution service scope from canonical state for agreements', () => {
    const participant = readyParticipant('p-attr', {
      compensationProfile: {
        compensationType: 'COMMISSION',
        percentage: 10,
        configured: true,
        customerAttributionEnabled: true,
        commissionSourceMode: 'selected',
        commissionServiceIds: ['svc-1', 'svc-2'],
        revenueSources: [],
      },
    });

    const state = reduceOperationalState({
      seed: {
        participants: [participant],
        catalogItemsByParticipant: {
          'p-attr': [
            { id: 'svc-1', name: 'VIP Table' },
            { id: 'svc-2', name: 'Bottle Service' },
          ],
        },
      },
    });

    const scope = deriveAttributionServiceScopeFromState(state, 'p-attr', [
      { id: 'svc-1', name: 'VIP Table' },
      { id: 'svc-2', name: 'Bottle Service' },
    ]);

    expect(scope.eligibleServices.length).toBe(2);
    expect(scope.scopeDefined).toBe(true);
  });

  it('throws MULTIPLE_OPERATIONAL_TRUTH_SOURCES_DETECTED when KPI paths diverge', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertMultipleOperationalTruthSources({
        canonicalKpis: 3,
        parallelKpiDerivation: 0,
      })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });

  it('end-to-end convergence: payout-ready counts and obligations agree across reducer', () => {
    const participants = Array.from({ length: 6 }, (_, i) =>
      readyParticipant(`p-${i + 1}`)
    );

    const state = reduceOperationalState({
      events: participants.flatMap((p) => [
        commissionEvent(p.id),
        {
          type: 'AGREEMENT_APPROVED',
          participantId: p.id,
          timestamp: '2026-05-20T12:00:00.000Z',
          source: 'server',
        },
        {
          type: 'PAYOUT_STATE_UPDATED',
          participantId: p.id,
          timestamp: '2026-05-20T13:00:00.000Z',
          source: 'server',
        },
      ]),
      seed: {
        participants,
        fundingAllocated: true,
        graphReady: true,
        graphSnapshotConverged: true,
      },
    });

    const kpis = deriveOperationalKPIs(state);
    expect(kpis.earningsConfiguredCount).toBe(6);
    expect(kpis.payoutReadyCount).toBe(6);
    expect(kpis.approvedAgreementCount).toBe(6);

    const obligations = deriveOperationalObligationsFromState({
      participants: state.participants,
      persistedObligations: [],
      funding: state.funding,
    });
    expect(obligations.length).toBeGreaterThan(0);

    assertCanonicalConvergenceInvariants({ state });
  });

  it('counts all 3 participants when compensation persisted without configured flag', () => {
    const participants = [
      readyParticipant('p-1'),
      readyParticipant('p-2', {
        compensationProfile: {
          compensationType: 'FIXED_FEE',
          fixedAmount: 1500,
          revenueSources: [],
          customerAttributionEnabled: false,
          commissionSourceMode: 'all_active',
          commissionServiceIds: [],
        },
      }),
      readyParticipant('p-3', {
        compensationProfile: {
          compensationType: 'REVENUE_SHARE',
          percentage: 12,
          revenueSources: [],
          customerAttributionEnabled: false,
          commissionSourceMode: 'all_active',
          commissionServiceIds: [],
        },
        commissionKind: 'pct_deal_value',
        commissionValue: 12,
        operationalStatus: 'active',
      }),
    ];

    const snapshot = getOperationalCoordinationSnapshot({
      participants,
      fundingAllocated: true,
    });

    expect(snapshot.summary.earningsConfiguredCount).toBe(3);
    expect(snapshot.summary.payoutReadyCount).toBe(3);

    const state = reduceOperationalState({
      seed: {
        participants,
        fundingAllocated: true,
        graphReady: true,
        graphSnapshotConverged: true,
      },
    });

    expect(state.kpis.earningsConfiguredCount).toBe(3);
    expect(state.kpis.participantsConfigured).toBe(true);
    expect(state.kpis.payoutReadyCount).toBe(3);
    expect(state.obligations.length).toBeGreaterThan(0);
  });

  it('derives payout-ready from persisted confirmations without compensation events', () => {
    const participants = [
      readyParticipant('p-a', { payoutVerificationConfirmed: true }),
      readyParticipant('p-b', { payoutVerificationConfirmed: true }),
    ];
    const snapshot = buildPersistedCoordinationSnapshot({ participants, fundingAllocated: true });
    const state = buildCanonicalStateFromSnapshot(snapshot, {
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
        releaseEligibleCount: 0,
        releaseBatchCount: 0,
        primaryProjectId: 'proj-1',
      },
      events: [],
    });

    expect(state.kpis.payoutReadyCount).toBe(2);
    expect(state.release.phase).not.toBe('INITIALIZING');

    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    assertPersistedEntityDominanceInvariants({
      payoutConfirmationCount: 2,
      payoutReadyCount: state.kpis.payoutReadyCount,
      persistedCompensationRowCount: 2,
      earningsConfiguredCount: state.kpis.earningsConfiguredCount,
    });
    process.env.NODE_ENV = prev;
  });
});
