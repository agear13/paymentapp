import {
  isSafeInternalRedirectPath,
  isSafeParticipantReturnPath,
  PARTICIPANT_WORKSPACE_CHOOSER_PATH,
  participantAuthReturnCookieOptions,
  participantTokenFromReturnPath,
  participantWorkspaceReturnPath,
  resolveAuthorizedParticipantDestination,
  uniqueAuthorizedParticipantReturnPath,
} from '@/lib/participant-portal/participant-auth-return';

describe('participant auth return paths', () => {
  const token = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  it('accepts the invitation workspace path', () => {
    expect(isSafeParticipantReturnPath(participantWorkspaceReturnPath(token))).toBe(true);
    expect(isSafeParticipantReturnPath(`/participant/${token}?step=payout`)).toBe(true);
    expect(participantTokenFromReturnPath(participantWorkspaceReturnPath(token))).toBe(token);
    expect(participantTokenFromReturnPath('/onboarding')).toBeNull();
    expect(participantTokenFromReturnPath('/auth/login')).toBeNull();
  });

  it('rejects open redirects and unrelated routes', () => {
    expect(isSafeParticipantReturnPath('https://evil.example/participant/' + token)).toBe(false);
    expect(isSafeParticipantReturnPath('//evil.example')).toBe(false);
    expect(isSafeParticipantReturnPath('/onboarding')).toBe(false);
    expect(isSafeParticipantReturnPath('/workspace')).toBe(false);
    expect(isSafeInternalRedirectPath('/onboarding')).toBe(true);
  });

  it('restores a workspace only when the authorised destination is unique', () => {
    const a = `/participant/${token}`;
    const b = '/participant/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    expect(uniqueAuthorizedParticipantReturnPath([a])).toBe(a);
    expect(uniqueAuthorizedParticipantReturnPath([a, `${a}?step=payout`])).toBe(a);
    expect(uniqueAuthorizedParticipantReturnPath([a, b])).toBeNull();
    expect(uniqueAuthorizedParticipantReturnPath([])).toBeNull();
    expect(uniqueAuthorizedParticipantReturnPath(['/onboarding', a, '/workspace'])).toBe(a);
    expect(resolveAuthorizedParticipantDestination([a])).toEqual({ kind: 'unique', path: a });
    expect(resolveAuthorizedParticipantDestination([a, b])).toEqual({
      kind: 'chooser',
      path: PARTICIPANT_WORKSPACE_CHOOSER_PATH,
    });
    expect(resolveAuthorizedParticipantDestination(['/onboarding', '/workspace'])).toEqual({
      kind: 'none',
    });
  });

  it('sets host-only Lax cookies with a 20-minute lifetime', () => {
    expect(participantAuthReturnCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 20 * 60,
    });
    expect(participantAuthReturnCookieOptions()).not.toHaveProperty('domain');
    expect(participantAuthReturnCookieOptions(true).maxAge).toBe(0);
  });
});
