jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/security/csrf', () => ({
  enforceCsrfForRequest: jest.fn(),
}));

jest.mock('@/lib/auth/email-verification', () => ({
  isEmailVerified: jest.fn(() => true),
}));

jest.mock('@/lib/participant-portal/participant-test-context.server', () => ({
  resolveRequestParticipantTestContext: jest.fn(
    async (input: { testContext?: unknown }) => input.testContext ?? null
  ),
}));

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    deal_network_pilot_participants: {
      updateMany: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/server/prisma';
import { authorizeParticipantRelationship } from '@/lib/participant-portal/participant-session.server';
import { createParticipantTestContextPayload } from '@/lib/participant-portal/participant-test-context';

const updateMany = prisma.deal_network_pilot_participants.updateMany as jest.Mock;

const OWNER = 'owner-user';
const PARTICIPANT_ID = 'p-qa-1';
const PORTAL_TOKEN = 'portal-token-1';

describe('authorizeParticipantRelationship test context binding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateMany.mockResolvedValue({ count: 1 });
  });

  it('does not write authenticated_user_id for a test_context grant', async () => {
    const testContext = createParticipantTestContextPayload({
      actorUserId: OWNER,
      participantId: PARTICIPANT_ID,
      portalToken: PORTAL_TOKEN,
    });

    const decision = await authorizeParticipantRelationship({
      user: { id: OWNER, email: 'owner@example.com' },
      participantId: PARTICIPANT_ID,
      participantEmail: 'qa@example.com',
      authenticatedUserId: null,
      dealOwnerUserId: OWNER,
      action: 'mutate',
      portalToken: PORTAL_TOKEN,
      testContext,
    });

    expect(decision).toEqual({
      status: 'ok',
      role: 'participant',
      accessGrant: 'test_context',
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('still binds on genuine first participant access', async () => {
    const decision = await authorizeParticipantRelationship({
      user: { id: 'qa-user', email: 'qa@example.com' },
      participantId: PARTICIPANT_ID,
      participantEmail: 'qa@example.com',
      authenticatedUserId: null,
      dealOwnerUserId: OWNER,
      action: 'mutate',
      testContext: null,
    });

    expect(decision.accessGrant).toBe('genuine');
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: PARTICIPANT_ID,
        OR: [{ authenticated_user_id: null }, { authenticated_user_id: 'qa-user' }],
      },
      data: { authenticated_user_id: 'qa-user' },
    });
  });
});
