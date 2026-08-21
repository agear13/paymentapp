import {
  decideParticipantCallbackRedirect,
  planParticipantCallbackSession,
  resolvePostExchangeSession,
} from '@/lib/participant-portal/participant-auth-callback';
import { evaluateParticipantAccess } from '@/lib/participant-portal/participant-access';

const TOKEN_PATH = '/participant/9c1e725e-45fd-4456-bf45-db4d710addf4';
const OWNER = 'owner-user';
const PARTICIPANT = { id: 'participant-user', email: 'jaynealisha77@gmail.com' };
const OPERATOR = { id: 'operator-user', email: 'alishajaynegeary@gmail.com' };

const invited = {
  invitedEmail: 'jaynealisha77@gmail.com',
  authenticatedUserId: null as string | null,
  dealOwnerUserId: OWNER,
};

describe('participant magic-link callback identity', () => {
  it('authorises the invited identity after a successful callback', () => {
    expect(
      decideParticipantCallbackRedirect({
        candidateReturn: TOKEN_PATH,
        exchangeSucceeded: true,
        sessionUser: PARTICIPANT,
        participant: invited,
      })
    ).toEqual({
      redirectPath: TOKEN_PATH,
      signOutLeftoverSession: false,
      sessionMatchesInvitedIdentity: true,
    });
  });

  it('keeps a successful wrong-account session on the invitation URL so access-denied can render', () => {
    expect(
      decideParticipantCallbackRedirect({
        candidateReturn: TOKEN_PATH,
        exchangeSucceeded: true,
        sessionUser: OPERATOR,
        participant: invited,
      })
    ).toEqual({
      redirectPath: TOKEN_PATH,
      signOutLeftoverSession: false,
      sessionMatchesInvitedIdentity: false,
    });
  });

  it('signs out a leftover wrong-account session when a stale or failed callback does not replace it', () => {
    expect(
      decideParticipantCallbackRedirect({
        candidateReturn: TOKEN_PATH,
        exchangeSucceeded: false,
        sessionUser: OPERATOR,
        participant: invited,
      })
    ).toEqual({
      redirectPath: TOKEN_PATH,
      signOutLeftoverSession: true,
      sessionMatchesInvitedIdentity: false,
    });
  });

  it('does not treat an old operator magic link as the invited participant', () => {
    const decision = decideParticipantCallbackRedirect({
      candidateReturn: TOKEN_PATH,
      exchangeSucceeded: true,
      sessionUser: OPERATOR,
      participant: { ...invited, authenticatedUserId: PARTICIPANT.id },
    });
    expect(decision.sessionMatchesInvitedIdentity).toBe(false);
    expect(decision.redirectPath).toBe(TOKEN_PATH);
    expect(decision.redirectPath).not.toBe('/onboarding');
    expect(decision.redirectPath).not.toBe('/workspace');
    expect(decision.redirectPath).not.toBe('/auth/login');
  });

  it('never signs out after a successful code exchange', () => {
    expect(
      decideParticipantCallbackRedirect({
        candidateReturn: TOKEN_PATH,
        exchangeSucceeded: true,
        sessionUser: PARTICIPANT,
        participant: invited,
      }).signOutLeftoverSession
    ).toBe(false);
    expect(
      decideParticipantCallbackRedirect({
        candidateReturn: TOKEN_PATH,
        exchangeSucceeded: true,
        sessionUser: OPERATOR,
        participant: invited,
      }).signOutLeftoverSession
    ).toBe(false);
    expect(
      decideParticipantCallbackRedirect({
        candidateReturn: TOKEN_PATH,
        exchangeSucceeded: true,
        sessionUser: null,
        participant: invited,
      }).signOutLeftoverSession
    ).toBe(false);
  });
});

describe('post-exchange session source of truth', () => {
  it('uses getUser() only when it confirms the newly exchanged user', () => {
    expect(
      resolvePostExchangeSession({
        exchangeSucceeded: true,
        exchangedUser: PARTICIPANT,
        getUserResult: PARTICIPANT,
      })
    ).toEqual({
      user: PARTICIPANT,
      exchangeSucceeded: true,
      getUserConfirmedNewSession: true,
    });
  });

  it('ignores leftover operator cookies after a successful participant exchange', () => {
    expect(
      resolvePostExchangeSession({
        exchangeSucceeded: true,
        exchangedUser: PARTICIPANT,
        getUserResult: OPERATOR,
      })
    ).toEqual({
      user: PARTICIPANT,
      exchangeSucceeded: true,
      getUserConfirmedNewSession: false,
    });
  });

  it('falls back to leftover getUser only when the exchange failed', () => {
    expect(
      resolvePostExchangeSession({
        exchangeSucceeded: false,
        exchangedUser: null,
        getUserResult: OPERATOR,
      })
    ).toEqual({
      user: OPERATOR,
      exchangeSucceeded: false,
      getUserConfirmedNewSession: false,
    });
  });
});

describe('wrong-operator recovery keeps the participant session after callback', () => {
  it('operator → recover → participant OTP callback persists, and a hard refresh still authorises the workspace', () => {
    const operatorOnInvitation = evaluateParticipantAccess({
      user: OPERATOR,
      participantEmail: invited.invitedEmail,
      authenticatedUserId: invited.authenticatedUserId,
      dealOwnerUserId: OWNER,
      action: 'read',
    });
    expect(operatorOnInvitation).toEqual({ status: 'denied', role: null });

    const afterRecover = evaluateParticipantAccess({
      user: null,
      participantEmail: invited.invitedEmail,
      authenticatedUserId: invited.authenticatedUserId,
      dealOwnerUserId: OWNER,
      action: 'read',
    });
    expect(afterRecover).toEqual({ status: 'unauthenticated', role: null });

    const callback = planParticipantCallbackSession({
      candidateReturn: TOKEN_PATH,
      exchangeSucceeded: true,
      exchangedUser: PARTICIPANT,
      getUserResult: OPERATOR,
      participant: invited,
    });

    expect(callback).toMatchObject({
      redirectPath: TOKEN_PATH,
      signOutLeftoverSession: false,
      sessionMatchesInvitedIdentity: true,
      persistExchangedSession: true,
      sessionUser: PARTICIPANT,
    });
    expect(callback.redirectPath).not.toBe('/auth/login');
    expect(callback.redirectPath).not.toBe('/workspace');
    expect(callback.redirectPath).not.toBe('/onboarding');

    const hardRefresh = evaluateParticipantAccess({
      user: callback.sessionUser,
      participantEmail: invited.invitedEmail,
      authenticatedUserId: invited.authenticatedUserId,
      dealOwnerUserId: OWNER,
      action: 'read',
    });
    expect(hardRefresh).toEqual({ status: 'ok', role: 'participant' });

    const hardRefreshMutate = evaluateParticipantAccess({
      user: callback.sessionUser,
      participantEmail: invited.invitedEmail,
      authenticatedUserId: PARTICIPANT.id,
      dealOwnerUserId: OWNER,
      action: 'mutate',
    });
    expect(hardRefreshMutate).toEqual({ status: 'ok', role: 'participant' });
  });

  it('does not sign out the invited identity when getUser() confirms the new session', () => {
    const callback = planParticipantCallbackSession({
      candidateReturn: TOKEN_PATH,
      exchangeSucceeded: true,
      exchangedUser: PARTICIPANT,
      getUserResult: PARTICIPANT,
      participant: invited,
    });
    expect(callback.getUserConfirmedNewSession).toBe(true);
    expect(callback.signOutLeftoverSession).toBe(false);
    expect(callback.persistExchangedSession).toBe(true);
  });
});
