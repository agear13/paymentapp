import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { ParticipantIdentityError, updateParticipantIdentity } from '@/lib/participants/update-participant-identity.server';

jest.mock('@/lib/deal-network-demo/pilot-snapshot.server', () => ({
  getPilotSnapshotForUser: jest.fn(),
  updatePilotParticipantPayload: jest.fn(),
}));

const { getPilotSnapshotForUser, updatePilotParticipantPayload } = jest.requireMock(
  '@/lib/deal-network-demo/pilot-snapshot.server'
);

function participant(overrides: Partial<DemoParticipant> = {}): DemoParticipant {
  return {
    id: 'p-1',
    name: 'Apples',
    email: 'old@example.com',
    role: 'Connector',
    commissionKind: 'pct_deal_value',
    commissionValue: 15,
    status: 'Pending',
    approvalStatus: 'Pending approval',
    inviteToken: 'invite-1',
    participantPortalToken: 'portal-1',
    authenticatedUserId: null,
    lastInvitationEmail: 'old@example.com',
    inviteSentAt: '2026-08-01T00:00:00.000Z',
    agreementSharedAt: '2026-08-01T00:00:00.000Z',
    compensationProfile: {
      compensationType: 'REVENUE_SHARE',
      percentage: 15,
      configured: true,
      revenueSources: [],
    },
    ...overrides,
  };
}

describe('updateParticipantIdentity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPilotSnapshotForUser.mockResolvedValue({
      deals: [],
      participants: [participant()],
    });
    updatePilotParticipantPayload.mockImplementation(
      async (_id: string, _userId: string, patch: Partial<DemoParticipant>) => ({
        ...participant(),
        ...patch,
      })
    );
  });

  it('updates name and email for an unbound participant and keeps the portal token', async () => {
    const result = await updateParticipantIdentity({
      participantId: 'p-1',
      operatorUserId: 'op-1',
      name: 'Apples Updated',
      email: 'new@example.com',
    });

    expect(result.emailChanged).toBe(true);
    expect(result.invitationResendRequired).toBe(true);
    expect(result.participant.email).toBe('new@example.com');
    expect(result.participant.participantPortalToken).toBe('portal-1');
    expect(result.participant.lastInvitationEmail).toBe('old@example.com');
    expect(updatePilotParticipantPayload).toHaveBeenCalledWith(
      'p-1',
      'op-1',
      expect.objectContaining({
        name: 'Apples Updated',
        email: 'new@example.com',
        lastInvitationEmail: 'old@example.com',
      })
    );
  });

  it('rejects silent email reassignment after identity is bound', async () => {
    getPilotSnapshotForUser.mockResolvedValue({
      deals: [],
      participants: [participant({ authenticatedUserId: 'bound-user' })],
    });

    await expect(
      updateParticipantIdentity({
        participantId: 'p-1',
        operatorUserId: 'op-1',
        email: 'someone-else@example.com',
      })
    ).rejects.toMatchObject({
      code: 'IDENTITY_BOUND',
      status: 409,
    } satisfies Partial<ParticipantIdentityError>);
    expect(updatePilotParticipantPayload).not.toHaveBeenCalled();
  });

  it('rejects replacing a bound participant email after approval', async () => {
    getPilotSnapshotForUser.mockResolvedValue({
      deals: [],
      participants: [participant({ approvalStatus: 'Approved', authenticatedUserId: null })],
    });

    await expect(
      updateParticipantIdentity({
        participantId: 'p-1',
        operatorUserId: 'op-1',
        email: 'replacement@example.com',
      })
    ).rejects.toMatchObject({ code: 'IDENTITY_BOUND' });
  });

  it('still allows a name-only edit after identity is bound', async () => {
    getPilotSnapshotForUser.mockResolvedValue({
      deals: [],
      participants: [participant({ authenticatedUserId: 'bound-user' })],
    });

    const result = await updateParticipantIdentity({
      participantId: 'p-1',
      operatorUserId: 'op-1',
      name: 'Apples Legal Name',
    });
    expect(result.emailChanged).toBe(false);
    expect(result.participant.name).toBe('Apples Legal Name');
    expect(result.participant.email).toBe('old@example.com');
  });

  it('adds an email after creation without recreating the participant', async () => {
    getPilotSnapshotForUser.mockResolvedValue({
      deals: [],
      participants: [participant({ email: '', lastInvitationEmail: null, inviteSentAt: undefined, agreementSharedAt: undefined })],
    });
    updatePilotParticipantPayload.mockImplementation(
      async (_id: string, _userId: string, patch: Partial<DemoParticipant>) => ({
        ...participant({ email: '', lastInvitationEmail: null }),
        ...patch,
      })
    );

    const result = await updateParticipantIdentity({
      participantId: 'p-1',
      operatorUserId: 'op-1',
      email: 'rachel@example.com',
    });

    expect(result.emailChanged).toBe(true);
    expect(result.invitationResendRequired).toBe(false);
    expect(result.participant.email).toBe('rachel@example.com');
    expect(updatePilotParticipantPayload).toHaveBeenCalledWith(
      'p-1',
      'op-1',
      expect.objectContaining({
        email: 'rachel@example.com',
      })
    );
  });

  it('corrects phone and role label without touching commission', async () => {
    const result = await updateParticipantIdentity({
      participantId: 'p-1',
      operatorUserId: 'op-1',
      phone: '0400 000 000',
      roleLabel: 'Community Organiser',
    });

    expect(result.emailChanged).toBe(false);
    expect(updatePilotParticipantPayload).toHaveBeenCalledWith(
      'p-1',
      'op-1',
      expect.objectContaining({
        name: 'Apples',
        email: 'old@example.com',
        phone: '0400 000 000',
        roleLabel: 'Community Organiser',
      })
    );
    expect(updatePilotParticipantPayload.mock.calls[0][2]).not.toHaveProperty('commissionValue');
    expect(updatePilotParticipantPayload.mock.calls[0][2]).not.toHaveProperty('agreementVersions');
    expect(result.participant.commissionValue).toBe(15);
  });
});
