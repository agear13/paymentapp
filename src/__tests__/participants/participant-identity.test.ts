import {
  canEditParticipantEmail,
  isInvitationDestinationStale,
  isParticipantIdentityBound,
  participantInvitationCopy,
} from '@/lib/participants/participant-identity';
import { evaluateParticipantAccess } from '@/lib/participant-portal/participant-access';

describe('participant identity editing rules', () => {
  it('allows email edits before authentication and approval', () => {
    expect(
      canEditParticipantEmail({
        authenticatedUserId: null,
        approvalStatus: 'Pending approval',
      })
    ).toBe(true);
    expect(isParticipantIdentityBound({ authenticatedUserId: null, approvalStatus: 'Pending approval' })).toBe(
      false
    );
  });

  it('locks email after authenticated_user_id is bound', () => {
    expect(
      canEditParticipantEmail({
        authenticatedUserId: 'user-1',
        approvalStatus: 'Pending approval',
      })
    ).toBe(false);
    expect(isParticipantIdentityBound({ authenticatedUserId: 'user-1' })).toBe(true);
  });

  it('locks email after agreement approval', () => {
    expect(
      canEditParticipantEmail({
        authenticatedUserId: null,
        approvalStatus: 'Approved',
      })
    ).toBe(false);
  });
});

describe('invitation destination copy', () => {
  it('shows the email the invitation will be sent to', () => {
    const copy = participantInvitationCopy({
      email: 'apples@example.com',
      lastInvitationEmail: null,
      agreementStatus: 'not_requested',
    });
    expect(copy.headline).toBe('Agreement ready to send');
    expect(copy.destinationEmail).toBe('apples@example.com');
    expect(copy.statusLine).toMatch(/Will be sent to/i);
  });

  it('shows the sent invitation destination', () => {
    const copy = participantInvitationCopy({
      email: 'betty@example.com',
      lastInvitationEmail: 'betty@example.com',
      agreementStatus: 'requested',
    });
    expect(copy.headline).toBe('Invitation sent to');
    expect(copy.destinationEmail).toBe('betty@example.com');
    expect(copy.statusLine).toMatch(/Awaiting participant approval/i);
    expect(copy.stale).toBe(false);
  });

  it('flags a stale invitation after the email changes', () => {
    expect(
      isInvitationDestinationStale({
        email: 'new@example.com',
        lastInvitationEmail: 'old@example.com',
      })
    ).toBe(true);
    const copy = participantInvitationCopy({
      email: 'new@example.com',
      lastInvitationEmail: 'old@example.com',
      agreementStatus: 'requested',
    });
    expect(copy.stale).toBe(true);
    expect(copy.previousDestinationEmail).toBe('old@example.com');
    expect(copy.destinationEmail).toBe('new@example.com');
  });
});

describe('email change revokes old workspace access', () => {
  const OWNER = 'owner-user';
  const OLD = { id: 'old-user', email: 'old@example.com' };
  const NEXT = { id: 'new-user', email: 'new@example.com' };

  it('denies the previous invited email after identity is updated', () => {
    expect(
      evaluateParticipantAccess({
        user: OLD,
        participantEmail: 'new@example.com',
        authenticatedUserId: null,
        dealOwnerUserId: OWNER,
        action: 'mutate',
      })
    ).toEqual({ status: 'denied', role: null, accessGrant: null });
  });

  it('allows the new invited email to use the workspace before binding', () => {
    expect(
      evaluateParticipantAccess({
        user: NEXT,
        participantEmail: 'new@example.com',
        authenticatedUserId: null,
        dealOwnerUserId: OWNER,
        action: 'mutate',
      })
    ).toEqual({ status: 'ok', role: 'participant', accessGrant: 'genuine' });
  });

  it('does not grant an unrelated user access after an email edit', () => {
    expect(
      evaluateParticipantAccess({
        user: { id: 'stranger', email: 'stranger@example.com' },
        participantEmail: 'new@example.com',
        authenticatedUserId: null,
        dealOwnerUserId: OWNER,
        action: 'mutate',
      })
    ).toEqual({ status: 'denied', role: null, accessGrant: null });
  });

  it('keeps operator preview after an unbound email change', () => {
    expect(
      evaluateParticipantAccess({
        user: { id: OWNER, email: 'owner@example.com' },
        participantEmail: 'new@example.com',
        authenticatedUserId: null,
        dealOwnerUserId: OWNER,
        action: 'read',
      })
    ).toEqual({ status: 'ok', role: 'operator_preview', accessGrant: 'operator_preview' });
  });
});
