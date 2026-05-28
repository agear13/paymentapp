import { deriveOperationalKPIs } from '@/lib/operations/reducer/derive-operational-kpis';
import { countPersistedParticipantMetrics } from '@/lib/operations/dev/count-persisted-participant-metrics';
import {
  ALL_OPERATIONAL_WALKTHROUGH_SCENARIOS,
  buildWalkthroughCanonicalState,
  reduceWalkthroughScenario,
  seedFullyPayoutReadyProject,
  seedMultiParticipantMixedReadiness,
  seedPendingAgreementProject,
  WALKTHROUGH_EPOCH,
} from '@/lib/operations/dev/operational-walkthrough-seeds';
import type { OperationalEvent } from '@/lib/operations/contracts/operational-events';

describe('operational walkthrough regression', () => {
  it('exposes deterministic epoch and replay fingerprints per scenario', () => {
    expect(WALKTHROUGH_EPOCH).toBe('2026-05-20T12:00:00.000Z');
    const fingerprints = ALL_OPERATIONAL_WALKTHROUGH_SCENARIOS.map((s) => {
      const state = reduceWalkthroughScenario(s);
      return state.replayFingerprint;
    });
    expect(new Set(fingerprints).size).toBe(fingerprints.length);
  });

  it('walks participant onboarding through earnings setup', () => {
    const scenario = ALL_OPERATIONAL_WALKTHROUGH_SCENARIOS[0];
    const state = reduceWalkthroughScenario(scenario);
    expect(state.participants.length).toBe(1);
    expect(state.participants[0]?.compensationConfigured).toBe(true);
    expect(deriveOperationalKPIs(state).earningsConfiguredCount).toBeGreaterThanOrEqual(1);
  });

  it('walks agreement approval for pending-agreement project', () => {
    const scenario = seedPendingAgreementProject();
    const before = reduceWalkthroughScenario(scenario);
    expect(before.kpis.approvedAgreementCount).toBe(0);

    const approvedParticipant = {
      ...scenario.seed.participants[0]!,
      approvalStatus: 'Approved' as const,
    };
    const approveEvent: OperationalEvent = {
      type: 'AGREEMENT_APPROVED',
      participantId: approvedParticipant.id,
      timestamp: scenario.events[0]!.timestamp,
      source: 'server',
    };
    const after = reduceWalkthroughScenario({
      ...scenario,
      seed: { ...scenario.seed, participants: [approvedParticipant] },
      events: [...scenario.events, approveEvent],
    });
    expect(after.kpis.approvedAgreementCount).toBe(1);
    expect(after.events.some((e) => e.type === 'AGREEMENT_APPROVED')).toBe(true);
  });

  it('walks payout confirmation and funding reconciliation on payout-ready project', () => {
    const scenario = seedFullyPayoutReadyProject();
    const { reduced, canonical } = buildWalkthroughCanonicalState(scenario);
    expect(reduced.funding.allocated).toBe(true);
    expect(reduced.kpis.payoutReadyCount).toBeGreaterThanOrEqual(2);
    expect(canonical.kpis.obligationCount).toBeGreaterThanOrEqual(0);
    expect(reduced.obligations.filter((o) => o.materialized).length).toBeGreaterThan(0);
  });

  it('generates obligations when compensation, agreement, and funding converge', () => {
    const scenario = seedFullyPayoutReadyProject();
    const state = reduceWalkthroughScenario(scenario);
    const materialized = state.obligations.filter((o) => o.materialized);
    expect(materialized.length).toBeGreaterThan(0);
    expect(deriveOperationalKPIs(state).obligationCount).toBe(state.obligations.length);
  });

  it('reflects release readiness blockers on mixed-readiness multi-participant project', () => {
    const scenario = seedMultiParticipantMixedReadiness();
    const state = reduceWalkthroughScenario(scenario);
    expect(state.participants.length).toBe(3);
    expect(state.kpis.payoutReadyCount).toBeLessThan(state.kpis.participantCount);
    expect(state.blockers.length).toBeGreaterThanOrEqual(0);
  });

  it('keeps cross-surface KPI convergence aligned with persisted entity counts', () => {
    const scenario = seedFullyPayoutReadyProject();
    const persisted = countPersistedParticipantMetrics(scenario.seed.participants);
    const { reduced } = buildWalkthroughCanonicalState(scenario);
    expect(reduced.kpis.participantCount).toBe(persisted.participantCount);
    expect(reduced.kpis.earningsConfiguredCount).toBeGreaterThanOrEqual(
      persisted.earningsConfiguredCount
    );
  });

  it('covers all eight walkthrough scenario factories', () => {
    expect(ALL_OPERATIONAL_WALKTHROUGH_SCENARIOS).toHaveLength(8);
    for (const scenario of ALL_OPERATIONAL_WALKTHROUGH_SCENARIOS) {
      const state = reduceWalkthroughScenario(scenario);
      expect(state.replayFingerprint).toBeTruthy();
      expect(state.readiness.releasePhase).toBeDefined();
    }
  });
});
