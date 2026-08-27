import {
  isEligibleParticipantTestSubject,
  isUsableParticipantTestContext,
  type ParticipantAccessGrant,
  type VerifiedParticipantTestContext,
} from '@/lib/participant-portal/participant-test-context';

export type ParticipantAccessAction = 'read' | 'mutate';

export type ParticipantAccessStatus = 'unauthenticated' | 'denied' | 'ok';

export type ParticipantAccessRole = 'participant' | 'operator_preview';

export type { ParticipantAccessGrant };

export type ParticipantAccessDecision = {
  status: ParticipantAccessStatus;
  role: ParticipantAccessRole | null;
  accessGrant: ParticipantAccessGrant | null;
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
  participantId?: string | null;
  portalToken?: string | null;
  testContext?: VerifiedParticipantTestContext | null;
}): ParticipantAccessDecision {
  if (!input.user) {
    return { status: 'unauthenticated', role: null, accessGrant: null };
  }

  const boundId = input.authenticatedUserId?.trim() || null;
  if (boundId && boundId === input.user.id) {
    return { status: 'ok', role: 'participant', accessGrant: 'genuine' };
  }

  const invited = normalizeParticipantEmail(input.participantEmail);
  const signedIn = normalizeParticipantEmail(input.user.email);
  const emailMatches = Boolean(invited && signedIn && invited === signedIn);

  if (emailMatches && (!boundId || boundId === input.user.id)) {
    return { status: 'ok', role: 'participant', accessGrant: 'genuine' };
  }

  if (
    isUsableParticipantTestContext({
      user: input.user,
      participantId: input.participantId,
      portalToken: input.portalToken,
      testContext: input.testContext,
    }) &&
    isEligibleParticipantTestSubject({
      actorUserId: input.user.id,
      dealOwnerUserId: input.dealOwnerUserId,
      authenticatedUserId: input.authenticatedUserId,
    }).eligible
  ) {
    return { status: 'ok', role: 'participant', accessGrant: 'test_context' };
  }

  if (input.action === 'read' && input.user.id === input.dealOwnerUserId) {
    return { status: 'ok', role: 'operator_preview', accessGrant: 'operator_preview' };
  }

  return { status: 'denied', role: null, accessGrant: null };
}

/**
 * Chooser / identity-fallback cards require the authenticated person to be the
 * invited participant. Deal-owner preview is never sufficient.
 * A verified server test context may grant participant identity for that row only.
 */
export function isAuthorisedParticipantWorkspaceIdentity(input: {
  user: { id: string; email?: string | null } | null;
  participantEmail?: string | null;
  authenticatedUserId?: string | null;
  dealOwnerUserId: string;
  participantId?: string | null;
  portalToken?: string | null;
  testContext?: VerifiedParticipantTestContext | null;
}): boolean {
  const decision = evaluateParticipantAccess({
    ...input,
    action: 'mutate',
  });
  return decision.status === 'ok' && decision.role === 'participant';
}
