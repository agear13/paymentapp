export type ParticipantAccessAction = 'read' | 'mutate';

export type ParticipantAccessStatus = 'unauthenticated' | 'denied' | 'ok';

export type ParticipantAccessRole = 'participant' | 'operator_preview';

export type ParticipantAccessDecision = {
  status: ParticipantAccessStatus;
  role: ParticipantAccessRole | null;
};

export function normalizeParticipantEmail(email?: string | null): string {
  return email?.trim().toLowerCase() ?? '';
}

export function evaluateParticipantAccess(input: {
  user: { id: string; email?: string | null } | null;
  participantEmail?: string | null;
  authenticatedUserId?: string | null;
  dealOwnerUserId: string;
  action: ParticipantAccessAction;
}): ParticipantAccessDecision {
  if (!input.user) {
    return { status: 'unauthenticated', role: null };
  }

  const boundId = input.authenticatedUserId?.trim() || null;
  if (boundId && boundId === input.user.id) {
    return { status: 'ok', role: 'participant' };
  }

  const invited = normalizeParticipantEmail(input.participantEmail);
  const signedIn = normalizeParticipantEmail(input.user.email);
  const emailMatches = Boolean(invited && signedIn && invited === signedIn);

  if (emailMatches && (!boundId || boundId === input.user.id)) {
    return { status: 'ok', role: 'participant' };
  }

  if (input.action === 'read' && input.user.id === input.dealOwnerUserId) {
    return { status: 'ok', role: 'operator_preview' };
  }

  return { status: 'denied', role: null };
}

/**
 * Chooser / identity-fallback cards require the authenticated person to be the
 * invited participant. Deal-owner preview is never sufficient.
 */
export function isAuthorisedParticipantWorkspaceIdentity(input: {
  user: { id: string; email?: string | null } | null;
  participantEmail?: string | null;
  authenticatedUserId?: string | null;
  dealOwnerUserId: string;
}): boolean {
  const decision = evaluateParticipantAccess({
    ...input,
    action: 'mutate',
  });
  return decision.status === 'ok' && decision.role === 'participant';
}
