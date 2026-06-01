import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { deriveCompensationState } from '@/lib/operations/derivations/derive-compensation-state';
import { hydrateOperationalParticipant } from '@/lib/operations/hydration/hydrate-operational-participant';

describe('incomplete compensation presentation', () => {
  it('shows Needs review when participation model is set without persisted terms', () => {
    const participant = hydrateOperationalParticipant({
      id: 'p-1',
      name: 'DJs',
      email: '',
      role: 'Contributor',
      commissionKind: 'pct_deal_value',
      commissionValue: 0,
      status: 'Pending',
      approvalStatus: 'Pending approval',
      inviteToken: 'tok',
      participationModel: 'revenue_share',
    } satisfies DemoParticipant);

    const state = deriveCompensationState(participant);
    expect(state.earningsPrimaryCompact).toBe('Needs review');
    expect(state.earningsSecondary).toBe('Compensation amount missing');
  });

  it('shows Not configured when no compensation structure exists', () => {
    const participant = hydrateOperationalParticipant({
      id: 'p-2',
      name: 'Volunteer',
      email: '',
      role: 'Contributor',
      commissionKind: 'fixed_amount',
      commissionValue: 0,
      status: 'Pending',
      approvalStatus: 'Pending approval',
      inviteToken: 'tok',
    } satisfies DemoParticipant);

    const state = deriveCompensationState(participant);
    expect(state.earningsPrimaryCompact).toBe('Not configured');
  });
});
