/** @jest-environment jsdom */

import * as React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import {
  ParticipantAccessDenied,
  ParticipantAuthGate,
} from '@/components/participant-portal/participant-auth-gate';

jest.mock('@/lib/security/csrf-fetch.client', () => ({
  csrfAwareFetch: jest.fn(),
  ensureClientCsrfReady: jest.fn().mockResolvedValue(undefined),
}));

const { csrfAwareFetch } = jest.requireMock('@/lib/security/csrf-fetch.client') as {
  csrfAwareFetch: jest.Mock;
};

describe('participant identity recovery UX', () => {
  beforeEach(() => {
    csrfAwareFetch.mockReset();
  });

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
    expect(text).toContain('Sign in to Referral program');
    expect(text).toContain("We'll send a secure sign-in link to");
    expect(text).toContain('jaynealisha77@gmail.com');
    expect(text).toContain('Send secure sign-in link');
    expect(text).not.toContain('You are not signed in yet');
    expect(text).not.toContain('Continue as');
    expect(text).not.toContain('Review agreement');
    expect(container.querySelector('[data-invitation-gate="sign-in-to-continue"]')).not.toBeNull();
  });

  it('confirms logout and keeps the same workspace sign-in context', () => {
    const { container } = render(
      <ParticipantAuthGate
        token="portal-1"
        invitation={{
          projectName: 'Summer Launch Party',
          hostLabel: 'Organiser',
          invitedEmail: 'alex@example.com',
        }}
        signedOut
      />
    );
    const text = container.textContent ?? '';
    expect(text).toContain("You've been signed out.");
    expect(text).toContain('Sign in again to continue to Summer Launch Party.');
    expect(text).toContain('Sign in to continue');
    expect(text).toContain('alex@example.com');
  });

  it('asks the participant to check email and allows sending another link', async () => {
    csrfAwareFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    const { container, getByRole } = render(
      <ParticipantAuthGate
        token="portal-1"
        invitation={{
          projectName: 'Summer Launch Party',
          hostLabel: 'Organiser',
          invitedEmail: 'alex@example.com',
        }}
      />
    );

    fireEvent.click(getByRole('button', { name: 'Send secure sign-in link' }));

    await waitFor(() => {
      expect(container.textContent).toContain('Check your email');
    });
    expect(container.textContent).toContain(
      "We've sent a secure sign-in link to alex@example.com."
    );
    expect(container.textContent).toContain(
      'Open the most recent email from Provvypay to continue.'
    );
    expect(getByRole('button', { name: 'Send another link' })).toBeTruthy();
    expect(csrfAwareFetch).toHaveBeenCalledWith(
      '/api/participant-portal/portal-1/auth/send-link',
      { method: 'POST', credentials: 'include' }
    );
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
      "You signed out of the previous account. We'll send a secure sign-in link to the invited email below."
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
