import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import {
  isMfaStepUpCode,
  stepUpRedirectUrl,
} from '@/lib/auth/step-up.client';
import type { MfaStepUpCode } from '@/lib/auth/mfa-assurance';

export type StepUpDenial = {
  code: MfaStepUpCode;
  error: string;
};

export type TotpStepUpResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      expired?: boolean;
      missingEnrollment?: boolean;
      unauthorized?: boolean;
    };

type MfaStatusPayload = {
  enrolled?: boolean;
  factors?: Array<{ id: string; status: string }>;
};

const normalizeTotpCode = (code: string): string => code.replace(/\s/g, '');

export const isSixDigitTotp = (code: string): boolean =>
  /^\d{6}$/.test(normalizeTotpCode(code));

export async function readStepUpDenial(response: Response): Promise<StepUpDenial | null> {
  if (response.status !== 403) return null;
  try {
    const payload = (await response.clone().json()) as { code?: unknown; error?: unknown };
    if (!isMfaStepUpCode(payload.code)) return null;
    return {
      code: payload.code,
      error: typeof payload.error === 'string' ? payload.error : 'Confirmation required.',
    };
  } catch {
    return null;
  }
}

export function redirectIfEnrollmentRequired(code: MfaStepUpCode): boolean {
  if (code !== 'MFA_ENROLLMENT_REQUIRED') return false;
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(stepUpRedirectUrl(code, next));
  return true;
}

export async function completeTotpStepUp(input: {
  code: string;
}): Promise<TotpStepUpResult> {
  const code = normalizeTotpCode(input.code);
  if (!isSixDigitTotp(code)) {
    return { ok: false, error: 'Enter the 6-digit code from your authenticator app.' };
  }

  const statusResponse = await csrfAwareFetch('/api/security/mfa/status');
  if (statusResponse.status === 401) {
    return { ok: false, error: 'Sign in again to continue.', unauthorized: true };
  }
  const status = (await statusResponse.json().catch(() => ({}))) as MfaStatusPayload;
  const factorId = status.factors?.find((factor) => factor.status === 'verified')?.id;
  if (!status.enrolled || !factorId) {
    return {
      ok: false,
      error: 'Two-factor authentication must be enabled before this action.',
      missingEnrollment: true,
    };
  }

  const challengeResponse = await csrfAwareFetch('/api/security/mfa/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ factorId }),
  });
  const challenge = (await challengeResponse.json().catch(() => ({}))) as {
    challengeId?: string;
    error?: string;
  };
  if (!challengeResponse.ok || !challenge.challengeId) {
    return {
      ok: false,
      error: challenge.error || 'Could not start authenticator confirmation.',
    };
  }

  const verifyResponse = await csrfAwareFetch('/api/security/mfa/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      factorId,
      challengeId: challenge.challengeId,
      code,
      purpose: 'step-up',
    }),
  });
  const verified = (await verifyResponse.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };
  if (!verifyResponse.ok) {
    return {
      ok: false,
      error: verified.error || 'Invalid authenticator code.',
      expired: verified.code === 'MFA_CHALLENGE_EXPIRED',
    };
  }

  return { ok: true };
}
