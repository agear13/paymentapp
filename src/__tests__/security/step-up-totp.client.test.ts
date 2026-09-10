/**
 * @jest-environment jsdom
 */

import { MFA_ENROLL_PATH } from '@/lib/auth/mfa-assurance';
import {
  completeTotpStepUp,
  isSixDigitTotp,
  readStepUpDenial,
  redirectIfEnrollmentRequired,
} from '@/lib/auth/step-up-totp.client';

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

describe('in-context TOTP step-up', () => {
  const assign = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        origin: 'https://app.example.com',
        pathname: '/workspace/settings/security',
        search: '',
        assign,
      },
    });
  });

  it('accepts only a 6-digit code', () => {
    expect(isSixDigitTotp('123456')).toBe(true);
    expect(isSixDigitTotp('12 34 56')).toBe(true);
    expect(isSixDigitTotp('12345')).toBe(false);
    expect(isSixDigitTotp('abcdef')).toBe(false);
  });

  it('reads a step-up denial without treating it as a generic failure', async () => {
    await expect(
      readStepUpDenial(
        jsonResponse(403, {
          code: 'STEP_UP_REQUIRED',
          error: 'Enter the 6-digit code from your authenticator app to confirm this action.',
        })
      )
    ).resolves.toEqual({
      code: 'STEP_UP_REQUIRED',
      error: 'Enter the 6-digit code from your authenticator app to confirm this action.',
    });
    await expect(readStepUpDenial(jsonResponse(403, { error: 'Forbidden' }))).resolves.toBeNull();
    await expect(readStepUpDenial(jsonResponse(401, { code: 'STEP_UP_REQUIRED' }))).resolves.toBeNull();
  });

  it('sends enrollment denials to the enroll page', () => {
    expect(redirectIfEnrollmentRequired('MFA_ENROLLMENT_REQUIRED')).toBe(true);
    expect(assign).toHaveBeenCalledWith(
      expect.stringContaining(MFA_ENROLL_PATH)
    );
    expect(redirectIfEnrollmentRequired('STEP_UP_REQUIRED')).toBe(false);
  });

  it('verifies a successful sensitive-action TOTP code', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          enrolled: true,
          factors: [{ id: 'factor-1', status: 'verified' }],
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { challengeId: 'challenge-1' }))
      .mockResolvedValueOnce(jsonResponse(200, { currentLevel: 'aal2' }));

    await expect(completeTotpStepUp({ code: '123456' })).resolves.toEqual({ ok: true });
    const verifyBody = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    expect(verifyBody).toEqual({
      factorId: 'factor-1',
      challengeId: 'challenge-1',
      code: '123456',
      purpose: 'step-up',
    });
    expect(JSON.stringify(verifyBody)).not.toMatch(/secret|otpauth/i);
  });

  it('rejects an invalid code without retrying the mutation', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          enrolled: true,
          factors: [{ id: 'factor-1', status: 'verified' }],
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { challengeId: 'challenge-1' }))
      .mockResolvedValueOnce(jsonResponse(401, { error: 'Invalid authenticator code.' }));

    await expect(completeTotpStepUp({ code: '000000' })).resolves.toEqual({
      ok: false,
      error: 'Invalid authenticator code.',
      expired: false,
    });
  });

  it('surfaces an expired challenge so the user can retry with a new code', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          enrolled: true,
          factors: [{ id: 'factor-1', status: 'verified' }],
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { challengeId: 'challenge-old' }))
      .mockResolvedValueOnce(
        jsonResponse(401, {
          error: 'This confirmation expired. Enter a new code.',
          code: 'MFA_CHALLENGE_EXPIRED',
        })
      );

    await expect(completeTotpStepUp({ code: '123456' })).resolves.toEqual({
      ok: false,
      error: 'This confirmation expired. Enter a new code.',
      expired: true,
    });
  });

  it('blocks step-up when MFA is not enrolled', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { enrolled: false, factors: [] }));
    await expect(completeTotpStepUp({ code: '123456' })).resolves.toEqual({
      ok: false,
      error: 'Two-factor authentication must be enabled before this action.',
      missingEnrollment: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats a signed-out session as unauthorized', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 'Authentication required' }));
    await expect(completeTotpStepUp({ code: '123456' })).resolves.toEqual({
      ok: false,
      error: 'Sign in again to continue.',
      unauthorized: true,
    });
  });

  it('surfaces a missing challenge so the user is not left waiting for a push', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          enrolled: true,
          factors: [{ id: 'factor-1', status: 'verified' }],
        })
      )
      .mockResolvedValueOnce(jsonResponse(400, { error: 'Could not start authenticator challenge.' }));

    await expect(completeTotpStepUp({ code: '123456' })).resolves.toEqual({
      ok: false,
      error: 'Could not start authenticator challenge.',
    });
  });

  it('creates a fresh challenge on each retry', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          enrolled: true,
          factors: [{ id: 'factor-1', status: 'verified' }],
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { challengeId: 'challenge-1' }))
      .mockResolvedValueOnce(jsonResponse(401, { error: 'Invalid authenticator code.' }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          enrolled: true,
          factors: [{ id: 'factor-1', status: 'verified' }],
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { challengeId: 'challenge-2' }))
      .mockResolvedValueOnce(jsonResponse(200, { currentLevel: 'aal2' }));

    await expect(completeTotpStepUp({ code: '000000' })).resolves.toMatchObject({ ok: false });
    await expect(completeTotpStepUp({ code: '123456' })).resolves.toEqual({ ok: true });

    const firstVerify = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    const secondVerify = JSON.parse(String(fetchMock.mock.calls[5][1]?.body));
    expect(firstVerify.challengeId).toBe('challenge-1');
    expect(secondVerify.challengeId).toBe('challenge-2');
  });
});
