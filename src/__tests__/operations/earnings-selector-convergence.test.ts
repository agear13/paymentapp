import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  isParticipantEarningsConfigured,
  isParticipantPayoutReadyForKpi,
  participantRendersCommercialTerms,
  countParticipantsEarningsConfigured,
} from '@/lib/operations/selectors/participant-earnings-selectors';
import { getOperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import { deriveWorkspaceParticipantPayoutSummary } from '@/lib/operations/readiness/participant-readiness';

function participantWithPersistedCompensation(
  overrides: Partial<DemoParticipant> = {}
): DemoParticipant {
  return {
    id: 'p-1',
    name: 'Alex',
    email: 'alex@test.com',
    role: 'Contributor',
    commissionKind: 'fixed_amount',
    commissionValue: 2500,
    status: 'Active',
    approvalStatus: 'Pending approval',
    inviteToken: 'tok',
    workspaceSource: 'project',
    operationalStatus: 'draft',
    payoutVerificationConfirmed: false,
    compensationProfile: {
      compensationType: 'FIXED_FEE',
      fixedAmount: 2500,
      configured: false,
      configuredAt: '2026-05-20T10:00:00.000Z',
      revenueSources: [],
      customerAttributionEnabled: false,
      commissionSourceMode: 'all_active',
      commissionServiceIds: [],
    },
    ...overrides,
  } as DemoParticipant;
}

describe('earnings selector convergence', () => {
  it('isParticipantEarningsConfigured recognizes persisted compensation without profile.configured flag', () => {
    const p = participantWithPersistedCompensation();
    expect(isParticipantEarningsConfigured(p)).toBe(true);
    expect(participantRendersCommercialTerms(p)).toBe(true);
  });

  it('aligns coordination snapshot and workspace summary KPI counts', () => {
    const participants = [
      participantWithPersistedCompensation({ id: 'p-1' }),
      participantWithPersistedCompensation({
        id: 'p-2',
        approvalStatus: 'Approved',
        payoutVerificationConfirmed: true,
      }),
    ];
    const snapshot = getOperationalCoordinationSnapshot({ participants });
    const workspace = deriveWorkspaceParticipantPayoutSummary(participants);

    expect(snapshot.summary.earningsConfiguredCount).toBe(2);
    expect(workspace.earningsConfiguredCount).toBe(2);
    expect(countParticipantsEarningsConfigured(participants)).toBe(2);
    expect(snapshot.summary.payoutReadyCount).toBe(
      participants.filter((p) => isParticipantPayoutReadyForKpi(p)).length
    );
  });
});
