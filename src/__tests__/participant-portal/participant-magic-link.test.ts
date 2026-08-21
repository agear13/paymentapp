import { buildParticipantAgreementInviteEmail } from '@/lib/email/templates/participant-agreement-invite';
import {
  buildAuthCallbackForwardUrl,
  buildParticipantMagicLinkRedirectTo,
  participantUrlNeedsAuthCallback,
  supabaseAuthRedirectAllowlistHints,
} from '@/lib/participant-portal/participant-magic-link';

const TOKEN = '9c1e725e-45fd-4456-bf45-db4d710addf4';
const ORIGIN = 'https://provvypay-api.onrender.com';

describe('participant magic-link destination', () => {
  it('points emailRedirectTo at /auth/callback?next=/participant/{token}', () => {
    expect(buildParticipantMagicLinkRedirectTo(ORIGIN, TOKEN)).toBe(
      `${ORIGIN}/auth/callback?next=${encodeURIComponent(`/participant/${TOKEN}`)}`
    );
    expect(buildParticipantMagicLinkRedirectTo(ORIGIN, TOKEN)).not.toBe(
      `${ORIGIN}/participant/${TOKEN}`
    );
  });

  it('lists production callback URLs that must be on the Supabase allowlist', () => {
    expect(supabaseAuthRedirectAllowlistHints(ORIGIN)).toEqual([
      `${ORIGIN}/auth/callback`,
      `${ORIGIN}/auth/callback/**`,
      `${ORIGIN}/auth/**`,
      `${ORIGIN}/**`,
    ]);
  });

  it('treats Review agreement as a workspace URL, not a magic link', () => {
    const email = buildParticipantAgreementInviteEmail({
      participantName: 'Jayne',
      operatorName: 'Alisha',
      projectName: 'Referral program',
      workspaceUrl: `${ORIGIN}/participant/${TOKEN}`,
    });
    expect(email.html).toContain(`href="${ORIGIN}/participant/${TOKEN}"`);
    expect(email.html).toContain('Review agreement');
    expect(email.html).not.toContain('/auth/callback');
    expect(email.html).not.toContain('code=');
  });

  it('forwards a code that landed on the participant URL to the callback handler', () => {
    expect(participantUrlNeedsAuthCallback(`?code=abc`, '')).toBe(true);
    expect(
      buildAuthCallbackForwardUrl({
        participantPath: `/participant/${TOKEN}`,
        search: '?code=abc',
        hash: '',
      })
    ).toBe(`/auth/callback?next=${encodeURIComponent(`/participant/${TOKEN}`)}&code=abc`);
  });

  it('forwards hash tokens that landed on the participant URL to the client completer', () => {
    const hash = '#access_token=tok&refresh_token=ref&type=magiclink';
    expect(participantUrlNeedsAuthCallback('', hash)).toBe(true);
    expect(
      buildAuthCallbackForwardUrl({
        participantPath: `/participant/${TOKEN}`,
        search: '',
        hash,
      })
    ).toBe(
      `/auth/callback/complete?next=${encodeURIComponent(`/participant/${TOKEN}`)}${hash}`
    );
  });
});
