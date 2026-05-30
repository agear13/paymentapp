import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { deriveParticipantViewStats } from '@/lib/operations/selectors/derive-participant-view-stats';
import { deriveParticipantPayoutReadiness } from '@/lib/operations/readiness/participant-readiness';
import { payoutVerificationLabelFromContract } from '@/lib/operations/contracts/participant-presentation';
import { hydrateParticipant } from '@/lib/operations/hydration/hydrate-participant';
import { deriveOperationalKPIsFromParticipants } from '@/lib/operations/reducer/derive-operational-kpis';
import { reduceOperationalState } from '@/lib/operations/reducer/reduce-operational-state';

function confirmedParticipant(id: string, name: string): DemoParticipant {
  return {
    id,
    name,
    email: `${id}@example.com`,
    role: 'Partner',
    approvalStatus: 'Approved',
    payoutVerificationConfirmed: true,
    compensationProfile: {
      configured: true,
      configuredAt: '2026-01-01T00:00:00.000Z',
      compensationType: 'FIXED_FEE',
      fixedAmount: 100,
    },
  };
}

describe('deriveParticipantViewStats — payout confirmation KPIs', () => {
  it('reports readyForPayout=4 and missingConfirmation=0 when all four are confirmed', () => {
    const participants = [
      confirmedParticipant('p-1', 'Artist One'),
      confirmedParticipant('p-2', 'Artist Two'),
      confirmedParticipant('p-3', 'Artist Three'),
      confirmedParticipant('p-4', 'DJ Alex'),
    ];

    const graphParticipants = participants.map((participant) => ({
      participant,
      agreementApproval: 'fully_approved' as const,
      payoutReadiness: deriveParticipantPayoutReadiness(participant),
      releaseReadiness: { releaseReady: false, blockers: [] },
      readinessHierarchy: { releaseReady: false, currencyBlockers: [] },
      blockers: [],
    }));

    const state = reduceOperationalState({
      seed: {
        participants,
        obligations: [],
        projectId: 'proj-1',
        graphReady: true,
        graphSnapshotConverged: true,
      },
      events: [],
    });

    const stats = deriveParticipantViewStats({
      canonicalKpis: state.kpis,
      graphParticipants,
    });

    expect(stats.readyForPayout).toBe(4);
    expect(stats.missingConfirmation).toBe(0);

    for (const participant of participants) {
      const hydrated = hydrateParticipant(participant);
      expect(
        payoutVerificationLabelFromContract(
          hydrated.lifecycle.payoutVerification,
          hydrated.payout.verifiedExternally,
          hydrated.payout.blocked
        )
      ).toBe('Confirmed');
    }
  });

  it('does not count confirmed participants when payoutReadiness.payoutConfirmed is undefined', () => {
    const participant = confirmedParticipant('p-1', 'Confirmed Only');
    const graphParticipants = [
      {
        participant,
        agreementApproval: 'fully_approved' as const,
        payoutReadiness: deriveParticipantPayoutReadiness(participant),
        releaseReadiness: { releaseReady: false, blockers: [] },
        readinessHierarchy: { releaseReady: false, currencyBlockers: [] },
        blockers: [],
      },
    ];

    expect(
      (graphParticipants[0]!.payoutReadiness as { payoutConfirmed?: boolean }).payoutConfirmed
    ).toBeUndefined();

    const kpis = deriveOperationalKPIsFromParticipants(
      [
        {
          participantId: participant.id,
          entity: participant,
          payoutReadiness: graphParticipants[0]!.payoutReadiness,
          releaseReadiness: graphParticipants[0]!.releaseReadiness as never,
          compensationConfigured: true,
          agreementApproved: true,
          payoutConfirmed: true,
          attributionActive: false,
        },
      ],
      [],
      0
    );

    const stats = deriveParticipantViewStats({ canonicalKpis: kpis, graphParticipants });
    expect(stats.readyForPayout).toBe(1);
    expect(stats.missingConfirmation).toBe(0);
  });
});
