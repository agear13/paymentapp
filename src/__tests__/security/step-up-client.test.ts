/**
 * @jest-environment jsdom
 */

import { MFA_CHALLENGE_PATH, MFA_ENROLL_PATH } from '@/lib/auth/mfa-assurance';
import {
  isMfaStepUpCode,
  redirectIfStepUpRequired,
  stepUpRedirectUrl,
} from '@/lib/auth/step-up.client';

function jsonResponse(status: number, body: object): Response {
  const payload = body;
  const response = {
    status,
    clone() {
      return jsonResponse(status, payload);
    },
    async json() {
      return payload;
    },
  };
  return response as Response;
}

describe('step-up client helper', () => {
  const assign = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        origin: 'https://app.example.com',
        pathname: '/workspace/connected/xero',
        search: '',
        assign,
      },
    });
  });

  it('recognizes MFA step-up codes', () => {
    expect(isMfaStepUpCode('STEP_UP_REQUIRED')).toBe(true);
    expect(isMfaStepUpCode('Failed to disconnect Xero')).toBe(false);
  });

  it('builds the existing MFA challenge URL without weakening AAL2', () => {
    expect(stepUpRedirectUrl('STEP_UP_REQUIRED', '/workspace/connected/xero')).toBe(
      `https://app.example.com${MFA_CHALLENGE_PATH}?next=${encodeURIComponent('/workspace/connected/xero')}&reason=STEP_UP_REQUIRED`
    );
    expect(stepUpRedirectUrl('MFA_ENROLLMENT_REQUIRED', '/workspace/connected/xero')).toContain(
      MFA_ENROLL_PATH
    );
  });

  it('redirects on 403 step-up and does not treat it as a generic failure', async () => {
    const response = jsonResponse(403, { code: 'STEP_UP_REQUIRED' });

    await expect(redirectIfStepUpRequired(response)).resolves.toBe(true);
    expect(assign).toHaveBeenCalledWith(
      stepUpRedirectUrl('STEP_UP_REQUIRED', '/workspace/connected/xero')
    );
  });

  it('ignores non-step-up failures so callers can still show an error', async () => {
    const response = jsonResponse(500, { error: 'Failed to disconnect Xero' });

    await expect(redirectIfStepUpRequired(response)).resolves.toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });
});
