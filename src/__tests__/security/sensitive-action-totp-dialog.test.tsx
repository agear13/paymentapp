/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SensitiveActionTotpDialog } from '@/components/auth/sensitive-action-totp-dialog';
import { completeTotpStepUp } from '@/lib/auth/step-up-totp.client';

jest.mock('@/lib/auth/step-up-totp.client', () => ({
  isSixDigitTotp: (code: string) => /^\d{6}$/.test(code.replace(/\s/g, '')),
  completeTotpStepUp: jest.fn(),
}));

const completeMock = completeTotpStepUp as jest.MockedFunction<typeof completeTotpStepUp>;

describe('SensitiveActionTotpDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('asks for a 6-digit authenticator code instead of a push approval', () => {
    render(
      <SensitiveActionTotpDialog open onOpenChange={jest.fn()} onVerified={jest.fn()} />
    );
    expect(screen.getByText('Confirm this action')).toBeInTheDocument();
    expect(
      screen.getByText('Enter the 6-digit code from your authenticator app.')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('6-digit verification code')).toBeInTheDocument();
    expect(screen.queryByText(/waiting for approval/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/notification/i)).not.toBeInTheDocument();
  });

  it('confirms a valid code and retries the sensitive action', async () => {
    completeMock.mockResolvedValue({ ok: true });
    const onVerified = jest.fn();
    const onOpenChange = jest.fn();
    render(
      <SensitiveActionTotpDialog open onOpenChange={onOpenChange} onVerified={onVerified} />
    );
    fireEvent.change(screen.getByLabelText('6-digit verification code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => {
      expect(completeMock).toHaveBeenCalledWith({ code: '123456' });
      expect(onVerified).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('keeps the dialog open on an invalid code so the user can retry', async () => {
    completeMock.mockResolvedValue({ ok: false, error: 'Invalid authenticator code.' });
    const onVerified = jest.fn();
    render(
      <SensitiveActionTotpDialog open onOpenChange={jest.fn()} onVerified={onVerified} />
    );
    fireEvent.change(screen.getByLabelText('6-digit verification code'), {
      target: { value: '000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid authenticator code.');
    expect(onVerified).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('lets the user cancel without completing the mutation', () => {
    const onOpenChange = jest.fn();
    const onVerified = jest.fn();
    render(
      <SensitiveActionTotpDialog open onOpenChange={onOpenChange} onVerified={onVerified} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onVerified).not.toHaveBeenCalled();
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('sends a missing enrollment to authenticator setup', async () => {
    completeMock.mockResolvedValue({
      ok: false,
      error: 'Two-factor authentication must be enabled before this action.',
      missingEnrollment: true,
    });
    render(
      <SensitiveActionTotpDialog open onOpenChange={jest.fn()} onVerified={jest.fn()} />
    );
    fireEvent.change(screen.getByLabelText('6-digit verification code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByRole('button', { name: 'Set up authenticator' })).toBeInTheDocument();
  });
});
