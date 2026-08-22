/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WorkspaceCreateScreen } from '@/components/journey/lovable/workspace-create-screen';
import {
  ACCOUNT_EXISTS_CODE,
  ACCOUNT_EXISTS_MESSAGE,
  GENERIC_AUTH_FAILURE,
  GENERIC_SIGNUP_FAILURE,
} from '@/lib/auth/auth-errors';

const mockReplace = jest.fn();
const mockRefresh = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      signInWithOAuth: jest.fn(),
    },
  }),
}));

jest.mock('@/lib/journey/complete-journey-onboarding.client', () => ({
  completeJourneyOnboarding: jest.fn(),
}));

jest.mock('@/lib/security/auth-audit.client', () => ({
  emitAuthAuditEvent: jest.fn(),
}));

jest.mock('@/components/auth/turnstile-widget', () => ({
  TurnstileWidget: () => null,
}));

const EMAIL = 'existing@company.com';
const PASSWORD = 'correct-horse-battery';

function mockFetch(signupBody: Record<string, unknown>, status = 409) {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/api/auth/turnstile-config')) {
      return {
        ok: true,
        json: async () => ({ required: false, siteKey: null }),
      } as Response;
    }
    if (url.includes('/api/auth/signup')) {
      expect(init?.method).toBe('POST');
      return {
        ok: false,
        json: async () => signupBody,
        status,
      } as Response;
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as jest.Mock;
}

async function submitSignupForm() {
  render(<WorkspaceCreateScreen />);

  fireEvent.change(screen.getByPlaceholderText('you@company.com'), {
    target: { value: EMAIL },
  });
  fireEvent.click(screen.getByRole('button', { name: /continue with email/i }));

  const passwordInputs = screen.getAllByPlaceholderText('••••••••');
  fireEvent.change(passwordInputs[0], { target: { value: PASSWORD } });
  fireEvent.change(passwordInputs[1], { target: { value: PASSWORD } });
  fireEvent.click(screen.getByRole('button', { name: /create account and continue/i }));
}

describe('WorkspaceCreateScreen signup failures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('switches to sign-in when signup reports ACCOUNT_EXISTS', async () => {
    mockFetch({
      error: ACCOUNT_EXISTS_MESSAGE,
      code: ACCOUNT_EXISTS_CODE,
    });

    await submitSignupForm();

    await waitFor(() => {
      expect(screen.getByText(ACCOUNT_EXISTS_MESSAGE)).toBeInTheDocument();
    });

    expect(screen.queryByText(GENERIC_AUTH_FAILURE)).not.toBeInTheDocument();
    expect(screen.queryByText(/invalid email or password/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in and continue/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@company.com')).toHaveValue(EMAIL);
    expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument();
  });

  it('shows the signup failure message, not login credentials copy, for unexpected errors', async () => {
    mockFetch(
      {
        error: GENERIC_SIGNUP_FAILURE,
      },
      400
    );

    await submitSignupForm();

    await waitFor(() => {
      expect(screen.getByText(GENERIC_SIGNUP_FAILURE)).toBeInTheDocument();
    });

    expect(screen.queryByText(GENERIC_AUTH_FAILURE)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account and continue/i })).toBeInTheDocument();
  });
});
