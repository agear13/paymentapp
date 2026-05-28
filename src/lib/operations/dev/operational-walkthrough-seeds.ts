import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { OperationalEvent } from '@/lib/operations/contracts/operational-events';
import type { OperationalReducerSeed } from '@/lib/operations/reducer/types';
import { reduceOperationalState } from '@/lib/operations/reducer/reduce-operational-state';
import { buildCanonicalStateFromSnapshot } from '@/lib/operations/reducer/adapters/legacy-selectors';
import { getOperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';

/** Deterministic walkthrough clock — replay-safe across browser + tests. */
export const WALKTHROUGH_EPOCH = '2026-05-20T12:00:00.000Z';

export function walkthroughTimestamp(offsetMinutes: number): string {
  const base = new Date(WALKTHROUGH_EPOCH).getTime();
  return new Date(base + offsetMinutes * 60_000).toISOString();
}

export function walkthroughParticipantId(scenario: string, index: number): string {
  return `wt-${scenario}-p${index}`;
}

export function walkthroughProjectId(scenario: string): string {
  return `wt-project-${scenario}`;
}

function baseParticipant(
  scenario: string,
  index: number,
  overrides: Partial<DemoParticipant> = {}
): DemoParticipant {
  const id = walkthroughParticipantId(scenario, index);
  return {
    id,
    name: `Walkthrough ${scenario} ${index}`,
    email: `${id}@walkthrough.test`,
    role: 'Contributor',
    commissionKind: 'fixed_amount',
    commissionValue: 1000 + index * 100,
    status: 'Active',
    approvalStatus: 'Pending approval',
    inviteToken: `token-${id}`,
    workspaceSource: 'project',
    operationalStatus: 'active',
    payoutVerificationConfirmed: false,
    compensationProfile: {
      compensationType: 'FIXED_FEE',
      fixedAmount: 1000 + index * 100,
      configured: false,
      revenueSources: [],
      customerAttributionEnabled: false,
      commissionSourceMode: 'all_active',
      commissionServiceIds: [],
    },
    ...overrides,
  } as DemoParticipant;
}

export type OperationalWalkthroughScenario = {
  id: string;
  label: string;
  seed: OperationalReducerSeed;
  events: OperationalEvent[];
};

function commissionEvent(participantId: string, at: string): OperationalEvent {
  return {
    type: 'PARTICIPANT_COMPENSATION_UPDATED',
    participantId,
    timestamp: at,
    source: 'server',
  };
}

/** A — standard commission participant */
export function seedStandardCommissionParticipant(): OperationalWalkthroughScenario {
  const scenario = 'commission';
  const p = baseParticipant(scenario, 1, {
    compensationProfile: {
      compensationType: 'FIXED_FEE',
      fixedAmount: 2500,
      configured: true,
      revenueSources: [],
      customerAttributionEnabled: false,
      commissionSourceMode: 'all_active',
      commissionServiceIds: [],
    },
  });
  const at = walkthroughTimestamp(0);
  return {
    id: scenario,
    label: 'Standard commission participant',
    seed: { participants: [p], projectId: walkthroughProjectId(scenario) },
    events: [commissionEvent(p.id, at)],
  };
}

/** B — hybrid participant */
export function seedHybridParticipant(): OperationalWalkthroughScenario {
  const scenario = 'hybrid';
  const p = baseParticipant(scenario, 1, {
    commissionKind: 'pct_deal_value',
    compensationProfile: {
      compensationType: 'HYBRID',
      fixedAmount: 1500,
      configured: true,
      revenueSources: ['svc-1'],
      customerAttributionEnabled: true,
      commissionSourceMode: 'selected',
      commissionServiceIds: ['svc-1'],
    },
  });
  return {
    id: scenario,
    label: 'Hybrid participant',
    seed: { participants: [p], projectId: walkthroughProjectId(scenario) },
    events: [commissionEvent(p.id, walkthroughTimestamp(1))],
  };
}

/** C — attribution participant */
export function seedAttributionParticipant(): OperationalWalkthroughScenario {
  const scenario = 'attribution';
  const p = baseParticipant(scenario, 1, {
    compensationProfile: {
      compensationType: 'REVENUE_SHARE',
      fixedAmount: 0,
      configured: true,
      revenueSources: ['svc-att'],
      customerAttributionEnabled: true,
      commissionSourceMode: 'selected',
      commissionServiceIds: ['svc-att'],
    },
  });
  return {
    id: scenario,
    label: 'Attribution participant',
    seed: { participants: [p], projectId: walkthroughProjectId(scenario) },
    events: [commissionEvent(p.id, walkthroughTimestamp(2))],
  };
}

/** D — fully payout-ready project */
export function seedFullyPayoutReadyProject(): OperationalWalkthroughScenario {
  const scenario = 'payout-ready';
  const p1 = baseParticipant(scenario, 1, {
    approvalStatus: 'Approved',
    payoutVerificationConfirmed: true,
    compensationProfile: {
      compensationType: 'FIXED_FEE',
      fixedAmount: 3000,
      configured: true,
      revenueSources: [],
      customerAttributionEnabled: false,
      commissionSourceMode: 'all_active',
      commissionServiceIds: [],
    },
  });
  const p2 = baseParticipant(scenario, 2, {
    approvalStatus: 'Approved',
    payoutVerificationConfirmed: true,
    compensationProfile: {
      compensationType: 'FIXED_FEE',
      fixedAmount: 2000,
      configured: true,
      revenueSources: [],
      customerAttributionEnabled: false,
      commissionSourceMode: 'all_active',
      commissionServiceIds: [],
    },
  });
  return {
    id: scenario,
    label: 'Fully payout-ready project',
    seed: {
      participants: [p1, p2],
      projectId: walkthroughProjectId(scenario),
      fundingAllocated: true,
      graphReady: true,
      graphSnapshotConverged: true,
    },
    events: [
      commissionEvent(p1.id, walkthroughTimestamp(3)),
      commissionEvent(p2.id, walkthroughTimestamp(4)),
      {
        type: 'AGREEMENT_APPROVED',
        participantId: p1.id,
        timestamp: walkthroughTimestamp(5),
        source: 'server',
      },
      {
        type: 'AGREEMENT_APPROVED',
        participantId: p2.id,
        timestamp: walkthroughTimestamp(6),
        source: 'server',
      },
      {
        type: 'FUNDING_ALLOCATION_RESERVED',
        timestamp: walkthroughTimestamp(7),
        source: 'server',
      },
    ],
  };
}

/** E — partially funded project */
export function seedPartiallyFundedProject(): OperationalWalkthroughScenario {
  const scenario = 'partial-funding';
  const p = baseParticipant(scenario, 1, {
    compensationProfile: {
      compensationType: 'FIXED_FEE',
      fixedAmount: 4000,
      configured: true,
      revenueSources: [],
      customerAttributionEnabled: false,
      commissionSourceMode: 'all_active',
      commissionServiceIds: [],
    },
  });
  return {
    id: scenario,
    label: 'Partially funded project',
    seed: {
      participants: [p],
      projectId: walkthroughProjectId(scenario),
      fundingAllocated: false,
      graphReady: true,
      graphSnapshotConverged: true,
    },
    events: [commissionEvent(p.id, walkthroughTimestamp(8))],
  };
}

/** F — pending agreement project */
export function seedPendingAgreementProject(): OperationalWalkthroughScenario {
  const scenario = 'pending-agreement';
  const p = baseParticipant(scenario, 1, {
    approvalStatus: 'Pending approval',
    compensationProfile: {
      compensationType: 'FIXED_FEE',
      fixedAmount: 1800,
      configured: true,
      revenueSources: [],
      customerAttributionEnabled: false,
      commissionSourceMode: 'all_active',
      commissionServiceIds: [],
    },
  });
  return {
    id: scenario,
    label: 'Pending agreement project',
    seed: { participants: [p], projectId: walkthroughProjectId(scenario), graphReady: true },
    events: [commissionEvent(p.id, walkthroughTimestamp(9))],
  };
}

/** G — funding reconciled but obligations pending */
export function seedFundingReconciledObligationsPending(): OperationalWalkthroughScenario {
  const scenario = 'funding-reconciled-obligations-pending';
  const p = baseParticipant(scenario, 1, {
    approvalStatus: 'Approved',
    compensationProfile: {
      compensationType: 'FIXED_FEE',
      fixedAmount: 2200,
      configured: true,
      revenueSources: [],
      customerAttributionEnabled: false,
      commissionSourceMode: 'all_active',
      commissionServiceIds: [],
    },
  });
  return {
    id: scenario,
    label: 'Funding reconciled, obligations pending',
    seed: {
      participants: [p],
      projectId: walkthroughProjectId(scenario),
      fundingAllocated: true,
      graphReady: true,
      graphSnapshotConverged: true,
    },
    events: [
      commissionEvent(p.id, walkthroughTimestamp(10)),
      {
        type: 'FUNDING_ALLOCATION_RESERVED',
        timestamp: walkthroughTimestamp(11),
        source: 'server',
      },
    ],
  };
}

/** H — multi-participant mixed readiness */
export function seedMultiParticipantMixedReadiness(): OperationalWalkthroughScenario {
  const scenario = 'mixed-readiness';
  const ready = baseParticipant(scenario, 1, {
    approvalStatus: 'Approved',
    payoutVerificationConfirmed: true,
    compensationProfile: {
      compensationType: 'FIXED_FEE',
      fixedAmount: 5000,
      configured: true,
      revenueSources: [],
      customerAttributionEnabled: false,
      commissionSourceMode: 'all_active',
      commissionServiceIds: [],
    },
  });
  const pending = baseParticipant(scenario, 2, {
    approvalStatus: 'Pending approval',
    compensationProfile: {
      compensationType: 'FIXED_FEE',
      fixedAmount: 1200,
      configured: true,
      revenueSources: [],
      customerAttributionEnabled: false,
      commissionSourceMode: 'all_active',
      commissionServiceIds: [],
    },
  });
  const unattributed = baseParticipant(scenario, 3);
  return {
    id: scenario,
    label: 'Multi-participant mixed readiness',
    seed: {
      participants: [ready, pending, unattributed],
      projectId: walkthroughProjectId(scenario),
      fundingAllocated: true,
      graphReady: true,
      graphSnapshotConverged: true,
    },
    events: [
      commissionEvent(ready.id, walkthroughTimestamp(12)),
      commissionEvent(pending.id, walkthroughTimestamp(13)),
    ],
  };
}

export const ALL_OPERATIONAL_WALKTHROUGH_SCENARIOS: OperationalWalkthroughScenario[] = [
  seedStandardCommissionParticipant(),
  seedHybridParticipant(),
  seedAttributionParticipant(),
  seedFullyPayoutReadyProject(),
  seedPartiallyFundedProject(),
  seedPendingAgreementProject(),
  seedFundingReconciledObligationsPending(),
  seedMultiParticipantMixedReadiness(),
];

export function reduceWalkthroughScenario(scenario: OperationalWalkthroughScenario) {
  return reduceOperationalState({
    seed: scenario.seed,
    events: scenario.events,
  });
}

export function buildWalkthroughCanonicalState(scenario: OperationalWalkthroughScenario) {
  const reduced = reduceWalkthroughScenario(scenario);
  const snapshot = getOperationalCoordinationSnapshot({
    participants: scenario.seed.participants,
    fundingAllocated: scenario.seed.fundingAllocated,
  });
  const participantCount = scenario.seed.participants.length;
  const activation = {
    hasOrganization: true,
    onboardingCompleted: true,
    projectCreated: true,
    participantCount,
    participantsConfigured: false,
    participantsConfiguredCount: 0,
    obligationCount: 0,
    paymentLinkCount: 0,
    collectionPreferenceDecideLater: false,
    defaultCurrency: 'USD',
    stripeConfigured: true,
    wiseConfigured: false,
    hederaConfigured: false,
    releaseEligibleCount: 0,
    releaseBatchCount: 0,
    primaryProjectId: scenario.seed.projectId ?? walkthroughProjectId(scenario.id),
  };
  const canonical = buildCanonicalStateFromSnapshot(snapshot, {
    activation,
    graphReady: scenario.seed.graphReady ?? true,
    graphSnapshotConverged: scenario.seed.graphSnapshotConverged ?? true,
  });
  return { reduced, snapshot, canonical };
}
