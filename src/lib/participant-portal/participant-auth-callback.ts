import { isAuthorisedParticipantWorkspaceIdentity } from '@/lib/participant-portal/participant-access';
import {
  isSafeParticipantReturnPath,
  participantTokenFromReturnPath,
} from '@/lib/participant-portal/participant-auth-return';

export type ParticipantCallbackSessionUser = {
  id: string;
  email?: string | null;
};

export type ParticipantCallbackLookup = {
  invitedEmail: string | null;
  authenticatedUserId: string | null;
  dealOwnerUserId: string;
};

export type ParticipantCallbackDecision = {
  /** Always a participant path when candidateReturn is a workspace invitation. */
  redirectPath: string;
  /**
   * Sign out leftover cookies only when a failed/stale callback would otherwise
   * keep a mismatched session (wrong-account recovery).
   * Never true after a successful code exchange — that would wipe the new session.
   */
  signOutLeftoverSession: boolean;
  sessionMatchesInvitedIdentity: boolean;
};

/**
 * After exchangeCodeForSession, request cookies can still reflect the previous user.
 * Trust the exchanged user as the new session identity. Only treat getUser() as
 * confirmation when it returns the same user id.
 */
export function resolvePostExchangeSession(input: {
  exchangeSucceeded: boolean;
  exchangedUser: ParticipantCallbackSessionUser | null;
  getUserResult: ParticipantCallbackSessionUser | null;
}): {
  user: ParticipantCallbackSessionUser | null;
  exchangeSucceeded: boolean;
  getUserConfirmedNewSession: boolean;
} {
  if (input.exchangeSucceeded && input.exchangedUser?.id) {
    const confirmed = input.getUserResult?.id === input.exchangedUser.id;
    return {
      user: confirmed && input.getUserResult ? input.getUserResult : input.exchangedUser,
      exchangeSucceeded: true,
      getUserConfirmedNewSession: confirmed,
    };
  }

  return {
    user: input.getUserResult,
    exchangeSucceeded: false,
    getUserConfirmedNewSession: false,
  };
}

export function decideParticipantCallbackRedirect(input: {
  candidateReturn: string;
  exchangeSucceeded: boolean;
  sessionUser: ParticipantCallbackSessionUser | null;
  participant: ParticipantCallbackLookup | null;
}): ParticipantCallbackDecision {
  const redirectPath = input.candidateReturn;
  const matches = Boolean(
    input.sessionUser &&
      input.participant &&
      isAuthorisedParticipantWorkspaceIdentity({
        user: input.sessionUser,
        participantEmail: input.participant.invitedEmail,
        authenticatedUserId: input.participant.authenticatedUserId,
        dealOwnerUserId: input.participant.dealOwnerUserId,
      })
  );

  if (matches) {
    return {
      redirectPath,
      signOutLeftoverSession: false,
      sessionMatchesInvitedIdentity: true,
    };
  }

  if (input.exchangeSucceeded) {
    return {
      redirectPath,
      signOutLeftoverSession: false,
      sessionMatchesInvitedIdentity: false,
    };
  }

  if (input.sessionUser && input.participant) {
    return {
      redirectPath,
      signOutLeftoverSession: true,
      sessionMatchesInvitedIdentity: false,
    };
  }

  return {
    redirectPath,
    signOutLeftoverSession: false,
    sessionMatchesInvitedIdentity: false,
  };
}

export type ParticipantCallbackPlan = ParticipantCallbackDecision & {
  sessionUser: ParticipantCallbackSessionUser | null;
  getUserConfirmedNewSession: boolean;
  persistExchangedSession: boolean;
};

/**
 * Ordered recovery callback:
 * exchange succeeds → persist new session → getUser confirms it when possible
 * → invited/bound identity check → redirect to participant URL.
 * A leftover operator cookie must not cause sign-out of the new participant.
 */
export function planParticipantCallbackSession(input: {
  candidateReturn: string;
  exchangeSucceeded: boolean;
  exchangedUser: ParticipantCallbackSessionUser | null;
  getUserResult: ParticipantCallbackSessionUser | null;
  participant: ParticipantCallbackLookup | null;
}): ParticipantCallbackPlan {
  const established = resolvePostExchangeSession({
    exchangeSucceeded: input.exchangeSucceeded,
    exchangedUser: input.exchangedUser,
    getUserResult: input.getUserResult,
  });
  const decision = decideParticipantCallbackRedirect({
    candidateReturn: input.candidateReturn,
    exchangeSucceeded: established.exchangeSucceeded,
    sessionUser: established.user,
    participant: input.participant,
  });

  return {
    ...decision,
    sessionUser: established.user,
    getUserConfirmedNewSession: established.getUserConfirmedNewSession,
    persistExchangedSession:
      established.exchangeSucceeded &&
      decision.sessionMatchesInvitedIdentity &&
      !decision.signOutLeftoverSession,
  };
}

export function isParticipantInvitationReturn(path: string | null | undefined): path is string {
  return Boolean(participantTokenFromReturnPath(path) && isSafeParticipantReturnPath(path));
}
