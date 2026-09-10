/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SignupCheckEmail } from '@/components/auth/signup-check-email';
import {
  SIGNUP_CHECK_EMAIL_BODY,
  SIGNUP_CHECK_EMAIL_TITLE,
} from '@/lib/auth/email-verification';

const EMAIL = 'new-operator@company.com';

describe('SignupCheckEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the check-your-email confirmation and spam hint', () => {
    render(<SignupCheckEmail email={EMAIL} initialCooldownSeconds={0} />);

    expect(screen.getByRole('heading', { name: SIGNUP_CHECK_EMAIL_TITLE })).toBeInTheDocument();
    expect(screen.getByText(SIGNUP_CHECK_EMAIL_BODY)).toBeInTheDocument();
    expect(screen.getByText(EMAIL)).toBeInTheDocument();
    expect(screen.getByText(/can't find it/i)).toBeInTheDocument();
    expect(screen.getByText(/spam or junk folder/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend verification email/i })).toBeEnabled();
  });

  it('starts on cooldown after signup so the user cannot immediately resend', () => {
    render(<SignupCheckEmail email={EMAIL} initialCooldownSeconds={60} />);
    expect(screen.getByRole('button', { name: /resend available in 60s/i })).toBeDisabled();
  });

  it('resends and shows confirmation without revealing account existence details', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        retryAfterSeconds: 60,
        message: 'If that email needs verification, we sent a new link.',
      }),
    }) as jest.Mock;

    render(<SignupCheckEmail email={EMAIL} initialCooldownSeconds={0} />);
    fireEvent.click(screen.getByRole('button', { name: /resend verification email/i }));

    await waitFor(() => {
      expect(screen.getByText('Verification email sent. Please check your inbox.')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/resend-verification',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: EMAIL }),
      })
    );
    expect(screen.getByRole('button', { name: /resend available in 60s/i })).toBeDisabled();
  });

  it('shows a graceful error when resend fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Could not send verification email. Please try again later.' }),
    }) as jest.Mock;

    render(<SignupCheckEmail email={EMAIL} initialCooldownSeconds={0} />);
    fireEvent.click(screen.getByRole('button', { name: /resend verification email/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Could not send verification email. Please try again later.')
      ).toBeInTheDocument();
    });
  });
});
