/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WorkspaceAccountSecurityPage } from '@/components/commercial-os/workspace-account-security-page';

jest.mock('next/link', () => {
  return function MockLink({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) {
    return <a href={href}>{children}</a>;
  };
});

jest.mock('@/hooks/use-client-csrf-ready', () => ({
  CSRF_PREPARING_LABEL: 'Preparing secure session...',
  useClientCsrfReady: () => ({ isReady: true, isPreparing: false }),
}));

jest.mock('@/components/dashboard/settings/last-login-section', () => ({
  LastLoginSection: () => <div>Last login</div>,
}));

jest.mock('@/lib/security/csrf-fetch.client', () => ({
  csrfAwareFetch: jest.fn(),
}));

import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';

const fetchMock = csrfAwareFetch as jest.MockedFunction<typeof csrfAwareFetch>;

function jsonResponse(status: number, body: object): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    clone() {
      return jsonResponse(status, body);
    },
    async json() {
      return body;
    },
  } as Response;
}

describe('Disable 2FA step-up UX', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/security/mfa/status')) {
        return jsonResponse(200, {
          enrolled: true,
          ownerMfaRequired: true,
          challengeRequired: false,
          unusedRecoveryCodeCount: 3,
          factors: [{ id: 'factor-1', status: 'verified', friendlyName: 'Authenticator' }],
        });
      }
      if (url.includes('/api/security/mfa/unenroll')) {
        return jsonResponse(403, {
          code: 'STEP_UP_REQUIRED',
          error: 'Enter the 6-digit code from your authenticator app to confirm this action.',
        });
      }
      return jsonResponse(500, { error: `Unexpected ${url}` });
    });
  });

  it('opens a TOTP confirmation instead of waiting for a push request', async () => {
    render(<WorkspaceAccountSecurityPage />);
    fireEvent.click(
      await screen.findByRole('button', { name: /Turn off two-factor authentication/i })
    );
    await waitFor(() => {
      expect(screen.getByText('Confirm this action')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Enter the 6-digit code from your authenticator app.')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('6-digit verification code')).toBeInTheDocument();
    expect(
      screen.queryByText(/Please confirm this action with your authenticator app/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/waiting for approval/i)).not.toBeInTheDocument();
  });

  it('cancels disable 2FA without sending another unenroll request', async () => {
    render(<WorkspaceAccountSecurityPage />);
    fireEvent.click(
      await screen.findByRole('button', { name: /Turn off two-factor authentication/i })
    );
    expect(await screen.findByText('Confirm this action')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByText('Confirm this action')).not.toBeInTheDocument();
    });
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/security/mfa/unenroll'))
    ).toHaveLength(1);
  });
});
