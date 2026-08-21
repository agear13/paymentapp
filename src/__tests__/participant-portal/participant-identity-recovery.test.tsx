/** @jest-environment jsdom */

import * as React from 'react';
import { render } from '@testing-library/react';
import {
  ParticipantAccessDenied,
  ParticipantAuthGate,
} from '@/components/participant-portal/participant-auth-gate';

jest.mock('@/lib/security/csrf-fetch.client', () => ({
  csrfAwareFetch: jest.fn(),
  ensureClientCsrfReady: jest.fn().mockResolvedValue(undefined),
}));

describe('participant identity recovery UX', () => {
  it('does not look like the invited email is already signed in', () => {
    const { container } = render(
      <ParticipantAuthGate
        token="portal-1"
        invitation={{
          projectName: 'Referral program',
          hostLabel: 'Organiser',
          invitedEmail: 'jaynealisha77@gmail.com',
        }}
      />
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Sign in to continue');
    expect(text).toContain('jaynealisha77@gmail.com');
    expect(text).toContain('Send secure sign-in link');
    expect(text).toContain('You are not signed in yet');
    expect(text).not.toContain('Continue as');
    expect(container.querySelector('[data-invitation-gate="sign-in-to-continue"]')).not.toBeNull();
  });

  it('explains recovery after signing out of the wrong account', () => {
    const { container } = render(
      <ParticipantAuthGate
        token="portal-1"
        invitation={{
          projectName: 'Referral program',
          hostLabel: 'Organiser',
          invitedEmail: 'jaynealisha77@gmail.com',
        }}
        recoveredFromWrongAccount
      />
    );
    expect(container.textContent).toContain(
      'You signed out of the previous account. We\'ll send a secure sign-in link to the invited email address above.'
    );
  });

  it('offers an explicit invited-account recovery action on access denied', () => {
    const { container } = render(
      <ParticipantAccessDenied
        signedInEmail="alishajaynegeary@gmail.com"
        onSignInWithInvitedAccount={() => undefined}
        onSignOut={() => undefined}
      />
    );
    const text = container.textContent ?? '';
    expect(text).toContain('This account does not have access');
    expect(text).toContain('alishajaynegeary@gmail.com');
    expect(text).toContain('Sign in with the invited account');
    expect(text).toContain('Log out');
  });
});
