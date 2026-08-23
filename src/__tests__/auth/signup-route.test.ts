import { NextRequest } from 'next/server';
import {
  ACCOUNT_EXISTS_CODE,
  ACCOUNT_EXISTS_MESSAGE,
  GENERIC_AUTH_FAILURE,
  GENERIC_SIGNUP_FAILURE,
  isExistingAccountSignupError,
} from '@/lib/auth/auth-errors';

jest.mock('@/lib/audit/auth-audit.server', () => ({
  recordAuthAuditEvent: jest.fn(),
}));

jest.mock('@/lib/auth/auth-rate-limit.server', () => ({
  checkRegistrationRateLimit: jest.fn(),
  incrementAuthFailureCounter: jest.fn(),
  rateLimit429Response: jest.fn(),
  getLoginLockoutRemaining: jest.fn(),
  recordLoginFailure: jest.fn(),
  clearLoginFailures: jest.fn(),
}));

jest.mock('@/lib/auth/login-tracking.server', () => ({
  recordSuccessfulLogin: jest.fn(),
}));

jest.mock('@/lib/auth/turnstile.server', () => ({
  isTurnstileRequired: jest.fn(),
  verifyTurnstileToken: jest.fn(),
}));

jest.mock('@/lib/supabase/route-handler-client', () => ({
  createRouteHandlerSupabaseClient: jest.fn(),
  resolveAuthRedirectOrigin: jest.fn(() => 'http://localhost:3000'),
}));

jest.mock('@/lib/rate-limit', () => ({
  getClientIdentifier: jest.fn(() => '127.0.0.1'),
}));

import { POST as signup } from '@/app/api/auth/signup/route';
import { POST as login } from '@/app/api/auth/login/route';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import {
  checkRegistrationRateLimit,
  incrementAuthFailureCounter,
  getLoginLockoutRemaining,
  recordLoginFailure,
} from '@/lib/auth/auth-rate-limit.server';
import { isTurnstileRequired } from '@/lib/auth/turnstile.server';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler-client';

const mockCheckRegistrationRateLimit = checkRegistrationRateLimit as jest.Mock;
const mockIncrementAuthFailureCounter = incrementAuthFailureCounter as jest.Mock;
const mockGetLoginLockoutRemaining = getLoginLockoutRemaining as jest.Mock;
const mockRecordLoginFailure = recordLoginFailure as jest.Mock;
const mockIsTurnstileRequired = isTurnstileRequired as jest.Mock;
const mockCreateRouteHandlerSupabaseClient = createRouteHandlerSupabaseClient as jest.Mock;
const mockRecordAuthAuditEvent = recordAuthAuditEvent as jest.Mock;

const VALID_PASSWORD = 'correct-horse-battery';
const VALID_EMAIL = 'operator@company.com';

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockSignUp(result: { data?: { user?: unknown; session?: unknown }; error?: unknown }) {
  const signUp = jest.fn().mockResolvedValue({
    data: { user: null, session: null, ...result.data },
    error: result.error ?? null,
  });
  mockCreateRouteHandlerSupabaseClient.mockResolvedValue({
    auth: { signUp },
  });
  return signUp;
}

describe('isExistingAccountSignupError', () => {
  it('maps the GoTrue "User already registered" message', () => {
    expect(isExistingAccountSignupError({ message: 'User already registered' })).toBe(true);
  });

  it('maps known existing-account codes', () => {
    expect(isExistingAccountSignupError({ code: 'user_already_exists' })).toBe(true);
    expect(isExistingAccountSignupError({ code: 'email_exists' })).toBe(true);
  });

  it('does not treat unrelated GoTrue errors as existing accounts', () => {
    expect(isExistingAccountSignupError({ message: 'Signup is disabled' })).toBe(false);
    expect(isExistingAccountSignupError({ message: 'Email rate limit exceeded' })).toBe(false);
  });
});

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRegistrationRateLimit.mockResolvedValue({ allowed: true });
    mockIncrementAuthFailureCounter.mockResolvedValue(1);
    mockIsTurnstileRequired.mockResolvedValue(false);
  });

  it('creates a new account when signUp succeeds with identities', async () => {
    const signUp = mockSignUp({
      data: {
        user: {
          id: 'user-1',
          email: VALID_EMAIL,
          identities: [{ id: 'identity-1', provider: 'email' }],
          email_confirmed_at: null,
        },
        session: null,
      },
    });

    const response = await signup(
      jsonRequest('http://localhost/api/auth/signup', {
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.requiresVerification).toBe(true);
    expect(body.error).toBeUndefined();
    expect(mockIncrementAuthFailureCounter).not.toHaveBeenCalled();
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: {
          emailRedirectTo:
            'http://localhost:3000/auth/callback?type=signup&redirectedFrom=%2Fjourney%2Fprovisioning%3Fbuild%3D1',
        },
      })
    );
  });

  it('returns ACCOUNT_EXISTS when signUp returns a user with empty identities', async () => {
    mockSignUp({
      data: {
        user: {
          id: 'user-existing',
          email: VALID_EMAIL,
          identities: [],
        },
        session: null,
      },
    });

    const response = await signup(
      jsonRequest('http://localhost/api/auth/signup', {
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe(ACCOUNT_EXISTS_CODE);
    expect(body.error).toBe(ACCOUNT_EXISTS_MESSAGE);
    expect(body.error).not.toBe(GENERIC_AUTH_FAILURE);
    expect(mockRecordAuthAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'existing_account_empty_identities',
        metadata: { scope: 'signup' },
      })
    );
  });

  it('maps "User already registered" to ACCOUNT_EXISTS', async () => {
    mockSignUp({
      error: { message: 'User already registered', code: 'user_already_exists' },
    });

    const response = await signup(
      jsonRequest('http://localhost/api/auth/signup', {
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe(ACCOUNT_EXISTS_CODE);
    expect(body.error).toBe(ACCOUNT_EXISTS_MESSAGE);
    expect(body.error).not.toContain('User already registered');
    expect(mockRecordAuthAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'User already registered',
        metadata: expect.objectContaining({ scope: 'signup' }),
      })
    );
  });

  it('does not display the login-style invalid-credentials message for unexpected signup errors', async () => {
    mockSignUp({
      error: { message: 'Error sending confirmation email', code: 'unexpected_failure' },
    });

    const response = await signup(
      jsonRequest('http://localhost/api/auth/signup', {
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe(GENERIC_SIGNUP_FAILURE);
    expect(body.error).not.toBe(GENERIC_AUTH_FAILURE);
    expect(body.error).not.toContain('Invalid email or password');
    expect(body.error).not.toContain('Error sending confirmation email');
    expect(body.code).toBeUndefined();
  });

  it('preserves password-policy, disposable-email, and payload messages', async () => {
    const policy = await signup(
      jsonRequest('http://localhost/api/auth/signup', {
        email: VALID_EMAIL,
        password: 'short',
      })
    );
    expect(policy.status).toBe(400);
    expect((await policy.json()).error).toMatch(/at least 12 characters/i);

    const disposable = await signup(
      jsonRequest('http://localhost/api/auth/signup', {
        email: 'temp@mailinator.com',
        password: VALID_PASSWORD,
      })
    );
    expect(disposable.status).toBe(400);
    expect((await disposable.json()).error).toMatch(/disposable/i);

    const payload = await signup(
      jsonRequest('http://localhost/api/auth/signup', {
        email: 'not-an-email',
        password: VALID_PASSWORD,
      })
    );
    expect(payload.status).toBe(400);
    expect((await payload.json()).error).toBe('Invalid signup payload');
  });
});

describe('POST /api/auth/login anti-enumeration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTurnstileRequired.mockResolvedValue(false);
    mockGetLoginLockoutRemaining.mockResolvedValue({ locked: false });
    mockRecordLoginFailure.mockResolvedValue({ locked: false, failureCount: 1 });
    mockIncrementAuthFailureCounter.mockResolvedValue(1);
  });

  it('still returns the generic credentials message on failed login', async () => {
    mockCreateRouteHandlerSupabaseClient.mockResolvedValue({
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials' },
        }),
      },
    });

    const response = await login(
      jsonRequest('http://localhost/api/auth/login', {
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe(GENERIC_AUTH_FAILURE);
    expect(body.code).toBeUndefined();
  });
});
