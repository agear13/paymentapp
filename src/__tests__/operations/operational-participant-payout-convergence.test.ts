import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  assertParticipantKpiConvergenceInvariants,
  OperationalInvariantViolation,
} from '@/lib/operations/dev/operational-invariants';
import {
  deduplicateReleaseBlockers,
  deriveOperationalReleaseBlockers,
} from '@/lib/operations/explainability/derive-operational-release-blockers';
import { getOperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import {
  activationFromOperationalGraph,
  workspaceContextFromGraph,
} from '@/lib/operations/selectors/operational-graph-adapter';
import {
  deriveParticipantPayoutReadiness,
  deriveWorkspaceParticipantPayoutSummary,
} from '@/lib/operations/readiness/participant-readiness';
import {
  inferCompensationConfiguredFromPersistence,
  isCompensationConfigured,
} from '@/lib/participants/participant-compensation';

function payoutReadyParticipant(id: string, overrides: Partial<DemoParticipant> = {}): DemoParticipant {
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

describe('operational participant payout convergence', () => {
  it('infers compensation configured from persisted row without configured flag', () => {
    const participant = payoutReadyParticipant('p-legacy', {
      compensationProfile: {
        compensationType: 'FIXED_FEE',
        fixedAmount: 2500,
        configured: false,
        revenueSources: [],
        customerAttributionEnabled: false,
        commissionSourceMode: 'all_active',
        commissionServiceIds: [],
      },
    });

    expect(inferCompensationConfiguredFromPersistence(participant)).toBe(true);
    expect(isCompensationConfigured(participant)).toBe(true);
    expect(deriveParticipantPayoutReadiness(participant).flags.hasCompensation).toBe(true);
  });

  it('derives workspace earnings counts from graph participants, not stale activation', () => {
    const participants = [
      payoutReadyParticipant('p-1'),
      payoutReadyParticipant('p-2'),
    ];
    const snapshot = getOperationalCoordinationSnapshot({ participants, fundingAllocated: true });

    const workspace = workspaceContextFromGraph(snapshot, {
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
    });

    expect(workspace.participantsConfiguredCount).toBe(2);
    expect(snapshot.summary.earningsConfiguredCount).toBe(2);
    expect(snapshot.summary.payoutReadyCount).toBe(2);

    const activation = activationFromOperationalGraph(snapshot, {
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
    });

    expect(activation.participantsConfiguredCount).toBe(2);
    expect(activation.participantsConfigured).toBe(true);
  });

  it('throws KPI_COUNTS_CONTRADICT_PARTICIPANT_ROWS when workspace KPI is zero with configured rows', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertParticipantKpiConvergenceInvariants({
        participantRowsWithCompensation: 3,
        workspaceEarningsConfiguredCount: 0,
        graphEarningsConfiguredCount: 3,
      })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });

  it('deduplicates release blockers by category fingerprint', () => {
    const blockers = deduplicateReleaseBlockers([
      {
        id: 'a',
        category: 'compensation_configuration_missing',
        reason: 'Release not ready — configure participant earnings',
        remediation: 'Save compensation',
        unlockCondition: 'All configured',
        ctaLabel: 'Configure earnings',
        ctaHref: '/participants',
        ctaIntent: 'configure_earnings',
        operatorActionRequired: true,
        severity: 'blocking',
      },
      {
        id: 'b',
        category: 'compensation_configuration_missing',
        reason: 'Release not ready — earnings setup incomplete',
        remediation: 'Save compensation',
        unlockCondition: 'All configured',
        ctaLabel: 'Configure earnings',
        ctaHref: '/participants',
        ctaIntent: 'configure_earnings',
        operatorActionRequired: true,
        severity: 'blocking',
      },
    ]);

    expect(blockers).toHaveLength(1);
  });

  it('does not emit workspace compensation blocker when graph participants are configured', () => {
    const participants = [payoutReadyParticipant('p-1')];
    const snapshot = getOperationalCoordinationSnapshot({ participants, fundingAllocated: true });
    const summary = deriveWorkspaceParticipantPayoutSummary(participants);

    expect(summary.participantsConfigured).toBe(true);

    const blockers = deriveOperationalReleaseBlockers({
      snapshot,
      workspace: {
        hasOrganization: true,
        onboardingCompleted: true,
        defaultCurrency: 'USD',
        stripeConfigured: true,
        wiseConfigured: false,
        hederaConfigured: false,
        projectCount: 1,
        primaryProjectId: 'proj-1',
        participantCount: 1,
        participantsConfiguredCount: 0,
        obligationCount: 0,
        paymentLinkCount: 0,
        collectionPreferenceDecideLater: false,
        releaseEligibleCount: 0,
        releaseBatchCount: 0,
      },
      graphReady: true,
    });

    expect(
      blockers.some((b) => b.category === 'compensation_configuration_missing')
    ).toBe(false);
  });
});
