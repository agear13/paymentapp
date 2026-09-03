import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import {
  COMMERCIAL_OS_ROUTES,
  journeySignupEmailRedirectTo,
  merchantPostVerificationDestination,
} from '@/lib/journey/commercial-os-routes';

const mockExchangeCodeForSession = jest.fn();
const mockVerifyOtp = jest.fn();
const mockGetUser = jest.fn();
const mockResolveParticipantAuthDestinationForUser = jest.fn();

jest.mock('@/lib/supabase/route-handler-client', () => ({
  createAuthCookieBuffer: () => ({
    cookies: [],
    names: () => [],
    applyTo: (response: { cookies?: { set?: unknown } }) => response,
  }),
  createRequestBoundSupabaseClient: jest.fn(() => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      verifyOtp: mockVerifyOtp,
      getUser: mockGetUser,
    },
  })),
}));

jest.mock('@/lib/participant-portal/participant-portal.server', () => ({
  findParticipantByPortalToken: jest.fn(),
  resolveParticipantAuthDestinationForUser: (...args: unknown[]) =>
    mockResolveParticipantAuthDestinationForUser(...args),
}));

jest.mock('@/lib/audit/auth-audit.server', () => ({
  recordAuthAuditEvent: jest.fn(),
}));

const mockRecordSuccessfulLogin = jest.fn();

jest.mock('@/lib/auth/login-tracking.server', () => ({
  recordSuccessfulLogin: (...args: unknown[]) => mockRecordSuccessfulLogin(...args),
}));

jest.mock('@/lib/runtime/customer-facing-url', () => ({
  resolveCanonicalPublicOrigin: () => 'https://www.provvypay.com',
  resolveParticipantAuthOrigin: () => 'https://www.provvypay.com',
  toAuthAppPath: (path: string) => (path.startsWith('/') ? path : `/${path}`),
}));

jest.mock('@/lib/logger', () => ({
  loggers: {
    auth: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  },
  log: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { GET as authCallback } from '@/app/auth/callback/route';

const VERIFIED_USER = {
  id: 'merchant-user',
  email: 'new-operator@company.com',
  email_confirmed_at: '2026-08-23T00:00:00Z',
  app_metadata: { provider: 'email' },
};

function callbackRequest(search: Record<string, string>) {
  const url = new URL('https://provvypay-api.onrender.com/auth/callback');
  for (const [key, value] of Object.entries(search)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('Commercial OS signup verification destination', () => {
  it('points confirmation emails at provisioning, including a type=signup fallback', () => {
    expect(journeySignupEmailRedirectTo('https://app.provvypay.com/')).toBe(
      'https://app.provvypay.com/auth/callback?type=signup&redirectedFrom=%2Fjourney%2Fprovisioning%3Fbuild%3D1'
    );
  });

  it('defaults merchant post-verification to the new journey, not old onboarding', () => {
    expect(merchantPostVerificationDestination(null)).toBe(COMMERCIAL_OS_ROUTES.journeyPostAuth);
    expect(merchantPostVerificationDestination('/onboarding')).toBe('/onboarding');
    expect(merchantPostVerificationDestination('/journey/provisioning?build=1')).toBe(
      COMMERCIAL_OS_ROUTES.journeyPostAuth
    );
  });

  it('wires signup and resend-verification to the journey confirmation URL', () => {
    expect(source('app/api/auth/signup/route.ts')).toContain('journeySignupEmailRedirectTo');
    expect(source('app/api/auth/resend-verification/route.ts')).toContain(
      'journeySignupEmailRedirectTo'
    );
    expect(source('app/api/auth/signup/route.ts')).not.toContain(
      'emailRedirectTo: `${origin}/auth/callback?type=signup`'
    );
  });

  it('keeps no-org home, onboarding, and Commercial OS layouts off the old first-org path', () => {
    const home = source('app/page.tsx');
    const onboardingLayout = source('app/(onboarding)/onboarding/layout.tsx');
    const commercialOsLayout = source('app/(commercial-os)/layout.tsx');

    expect(home).toContain('COMMERCIAL_OS_ROUTES.journeyPostAuth');
    expect(home).not.toContain("redirect('/onboarding')");
    expect(onboardingLayout).toContain('COMMERCIAL_OS_ROUTES.journeyPostAuth');
    expect(onboardingLayout).toContain("subscription_plan !== 'starter'");
    expect(commercialOsLayout).toContain('COMMERCIAL_OS_ROUTES.journeyPostAuth');
    expect(commercialOsLayout).not.toContain("redirect('/onboarding')");
  });
});

describe('auth callback merchant signup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordSuccessfulLogin.mockResolvedValue({ suspicious: false });
    mockResolveParticipantAuthDestinationForUser.mockResolvedValue({ kind: 'none' });
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: VERIFIED_USER, session: { user: VERIFIED_USER } },
      error: null,
    });
    mockGetUser.mockResolvedValue({ data: { user: VERIFIED_USER }, error: null });
  });

  it('sends a newly verified merchant to Commercial OS provisioning when redirectedFrom is missing', async () => {
    const response = await authCallback(
      callbackRequest({ code: 'signup-code', type: 'signup' })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      `https://www.provvypay.com${COMMERCIAL_OS_ROUTES.journeyPostAuth}`
    );
    expect(response.headers.get('location')).not.toContain('/onboarding');
  });

  it('honours an explicit journey redirectedFrom after verification', async () => {
    const response = await authCallback(
      callbackRequest({
        code: 'signup-code',
        type: 'signup',
        redirectedFrom: COMMERCIAL_OS_ROUTES.journeyPostAuth,
      })
    );

    expect(response.headers.get('location')).toBe(
      `https://www.provvypay.com${COMMERCIAL_OS_ROUTES.journeyPostAuth}`
    );
  });

  it('still restores a unique participant destination ahead of the merchant fallback', async () => {
    mockResolveParticipantAuthDestinationForUser.mockResolvedValue({
      kind: 'unique',
      path: '/participant/9c1e725e-45fd-4456-bf45-db4d710addf4',
    });

    const response = await authCallback(
      callbackRequest({ code: 'signup-code', type: 'signup' })
    );

    expect(response.headers.get('location')).toBe(
      'https://www.provvypay.com/participant/9c1e725e-45fd-4456-bf45-db4d710addf4'
    );
  });

  it('forwards type=signup hash-token callbacks to provisioning when no code is present', async () => {
    const response = await authCallback(callbackRequest({ type: 'signup' }));

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toContain('/auth/callback/complete');
    expect(response.headers.get('location')).toContain(
      encodeURIComponent(COMMERCIAL_OS_ROUTES.journeyPostAuth)
    );
  });

  it('still routes new merchants to provisioning when login tracking fails', async () => {
    mockRecordSuccessfulLogin.mockRejectedValue(new Error('user_auth_profiles unavailable'));

    const response = await authCallback(
      callbackRequest({
        code: 'signup-code',
        type: 'signup',
        redirectedFrom: COMMERCIAL_OS_ROUTES.journeyPostAuth,
      })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      `https://www.provvypay.com${COMMERCIAL_OS_ROUTES.journeyPostAuth}`
    );
  });

  it('still routes new merchants to provisioning when participant destination lookup fails', async () => {
    mockResolveParticipantAuthDestinationForUser.mockRejectedValue(
      new Error('deal_network_pilot_participants unavailable')
    );

    const response = await authCallback(
      callbackRequest({
        code: 'signup-code',
        type: 'signup',
        redirectedFrom: COMMERCIAL_OS_ROUTES.journeyPostAuth,
      })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      `https://www.provvypay.com${COMMERCIAL_OS_ROUTES.journeyPostAuth}`
    );
  });
});
