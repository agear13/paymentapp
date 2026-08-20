'use client';

import { MFA_CHALLENGE_PATH, MFA_ENROLL_PATH, type MfaStepUpCode } from '@/lib/auth/mfa-assurance';

const STEP_UP_CODES = new Set<MfaStepUpCode>([
  'MFA_ENROLLMENT_REQUIRED',
  'MFA_CHALLENGE_REQUIRED',
  'STEP_UP_REQUIRED',
]);

export function isMfaStepUpCode(code: unknown): code is MfaStepUpCode {
  return typeof code === 'string' && STEP_UP_CODES.has(code as MfaStepUpCode);
}

export function stepUpRedirectUrl(code: MfaStepUpCode, nextPath: string): string {
  const dest = code === 'MFA_ENROLLMENT_REQUIRED' ? MFA_ENROLL_PATH : MFA_CHALLENGE_PATH;
  const url = new URL(dest, window.location.origin);
  url.searchParams.set('next', nextPath);
  url.searchParams.set('reason', code);
  return url.toString();
}

/**
 * If a mutating API denied the action pending MFA/AAL2, send the user through
 * the existing step-up flow and return true. Callers must not treat this as a
 * generic failure.
 */
export async function redirectIfStepUpRequired(response: Response): Promise<boolean> {
  if (response.status !== 403) return false;

  let payload: { code?: unknown } | null = null;
  try {
    payload = (await response.clone().json()) as { code?: unknown };
  } catch {
    return false;
  }

  if (!isMfaStepUpCode(payload?.code)) return false;

  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(stepUpRedirectUrl(payload.code, next));
  return true;
}
