import {
  evaluateParticipantAccess,
  isAuthorisedParticipantWorkspaceIdentity,
  normalizeParticipantEmail,
} from '@/lib/participant-portal/participant-access';

const OWNER = 'owner-user';
const PARTICIPANT = 'participant-user';
const OTHER = 'other-user';

describe('participant access evaluation', () => {
  it('normalizes invited emails', () => {
    expect(normalizeParticipantEmail('  Person@Example.COM ')).toBe('person@example.com');
    expect(normalizeParticipantEmail(null)).toBe('');
  });

  it('requires authentication for both read and mutate', () => {
    expect(
      evaluateParticipantAccess({
        user: null,
        participantEmail: 'person@example.com',
        authenticatedUserId: null,
        dealOwnerUserId: OWNER,
        action: 'read',
      })
    ).toEqual({ status: 'unauthenticated', role: null });

    expect(
      evaluateParticipantAccess({
        user: null,
        participantEmail: 'person@example.com',
        authenticatedUserId: PARTICIPANT,
        dealOwnerUserId: OWNER,
        action: 'mutate',
      })
    ).toEqual({ status: 'unauthenticated', role: null });
  });

  it('grants the invited identity access by email on first sign-in', () => {
    expect(
      evaluateParticipantAccess({
        user: { id: PARTICIPANT, email: 'person@example.com' },
        participantEmail: 'Person@example.com',
        authenticatedUserId: null,
        dealOwnerUserId: OWNER,
        action: 'mutate',
      })
    ).toEqual({ status: 'ok', role: 'participant' });
  });

  it('grants access by bound authenticated_user_id even if email later changes', () => {
    expect(
      evaluateParticipantAccess({
        user: { id: PARTICIPANT, email: 'new@example.com' },
        participantEmail: 'person@example.com',
        authenticatedUserId: PARTICIPANT,
        dealOwnerUserId: OWNER,
        action: 'mutate',
      })
    ).toEqual({ status: 'ok', role: 'participant' });
  });

  it('denies a forwarded URL when a different authenticated user is signed in', () => {
    expect(
      evaluateParticipantAccess({
        user: { id: OTHER, email: 'forwarded@example.com' },
        participantEmail: 'person@example.com',
        authenticatedUserId: null,
        dealOwnerUserId: OWNER,
        action: 'mutate',
      })
    ).toEqual({ status: 'denied', role: null });
  });

  it('denies a second account after the invited identity is already bound', () => {
    expect(
      evaluateParticipantAccess({
        user: { id: OTHER, email: 'person@example.com' },
        participantEmail: 'person@example.com',
        authenticatedUserId: PARTICIPANT,
        dealOwnerUserId: OWNER,
        action: 'mutate',
      })
    ).toEqual({ status: 'denied', role: null });
  });

  it('lets the deal owner preview the workspace but not mutate', () => {
    expect(
      evaluateParticipantAccess({
        user: { id: OWNER, email: 'owner@example.com' },
        participantEmail: 'person@example.com',
        authenticatedUserId: null,
        dealOwnerUserId: OWNER,
        action: 'read',
      })
    ).toEqual({ status: 'ok', role: 'operator_preview' });

    expect(
      evaluateParticipantAccess({
        user: { id: OWNER, email: 'owner@example.com' },
        participantEmail: 'person@example.com',
        authenticatedUserId: null,
        dealOwnerUserId: OWNER,
        action: 'mutate',
      })
    ).toEqual({ status: 'denied', role: null });
  });

  it('does not let access to one bound participant grant another workspace', () => {
    expect(
      evaluateParticipantAccess({
        user: { id: PARTICIPANT, email: 'person@example.com' },
        participantEmail: 'someone-else@example.com',
        authenticatedUserId: 'different-participant-user',
        dealOwnerUserId: OWNER,
        action: 'read',
      })
    ).toEqual({ status: 'denied', role: null });
  });
});

describe('isAuthorisedParticipantWorkspaceIdentity', () => {
  it('allows only the invited participant identity', () => {
    expect(
      isAuthorisedParticipantWorkspaceIdentity({
        user: { id: PARTICIPANT, email: 'betty@email.com' },
        participantEmail: 'betty@email.com',
        authenticatedUserId: null,
        dealOwnerUserId: OWNER,
      })
    ).toBe(true);
  });

  it('excludes deal-owner operator preview from the chooser', () => {
    expect(
      isAuthorisedParticipantWorkspaceIdentity({
        user: { id: OWNER, email: 'owner@example.com' },
        participantEmail: 'betty@email.com',
        authenticatedUserId: null,
        dealOwnerUserId: OWNER,
      })
    ).toBe(false);
  });

  it('ignores a client-supplied email that does not match the session user', () => {
    expect(
      isAuthorisedParticipantWorkspaceIdentity({
        user: { id: OTHER, email: 'attacker@example.com' },
        participantEmail: 'betty@email.com',
        authenticatedUserId: null,
        dealOwnerUserId: OWNER,
      })
    ).toBe(false);
  });

  it('does not treat a portal token holder as authorised without identity match', () => {
    expect(
      isAuthorisedParticipantWorkspaceIdentity({
        user: { id: OTHER, email: 'forwarded@example.com' },
        participantEmail: 'betty@email.com',
        authenticatedUserId: PARTICIPANT,
        dealOwnerUserId: OWNER,
      })
    ).toBe(false);
  });
});
