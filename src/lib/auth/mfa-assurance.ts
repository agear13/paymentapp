/**
 * Pure MFA / AAL helpers — no I/O. Safe to unit-test without Supabase.
 */

export const STEP_UP_MAX_AGE_SECONDS = Number.parseInt(
  process.env.AUTH_STEP_UP_MAX_AGE_SECONDS || '600',
  10
);

export const MFA_CHALLENGE_PATH = '/auth/mfa';
export const MFA_ENROLL_PATH = '/workspace/settings/security';

export type AmrEntry = {
  method?: string | null;
  timestamp?: number | null;
};

export type MfaStepUpCode =
  | 'MFA_ENROLLMENT_REQUIRED'
  | 'MFA_CHALLENGE_REQUIRED'
  | 'STEP_UP_REQUIRED';

export const MFA_STEP_UP_MESSAGES: Record<MfaStepUpCode, string> = {
  MFA_ENROLLMENT_REQUIRED:
    'Two-factor authentication must be enabled before this action.',
  MFA_CHALLENGE_REQUIRED:
    'Two-factor authentication is required. Enter the code from your authenticator app.',
  STEP_UP_REQUIRED:
    'Please confirm this action with your authenticator app.',
};

export function isRecoveryAmrMethod(method: string | null | undefined): boolean {
  if (!method) return false;
  return method.toLowerCase() === 'recovery';
}

export function hasRecoveryAmr(methods: AmrEntry[] | null | undefined): boolean {
  return Boolean(methods?.some((entry) => isRecoveryAmrMethod(entry.method)));
}

export function isTotpAmrMethod(method: string | null | undefined): boolean {
  if (!method) return false;
  const normalized = method.toLowerCase();
  return normalized.includes('totp') || normalized === 'mfa';
}

export function hasRecentTotpAmr(
  methods: AmrEntry[] | null | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
  maxAgeSeconds = STEP_UP_MAX_AGE_SECONDS
): boolean {
  if (!methods?.length) return false;
  return methods.some((entry) => {
    if (!isTotpAmrMethod(entry.method)) return false;
    const timestamp = typeof entry.timestamp === 'number' ? entry.timestamp : 0;
    if (timestamp <= 0) return false;
    return nowSeconds - timestamp <= maxAgeSeconds;
  });
}

export function countVerifiedTotpFactors(
  factors: Array<{ factor_type?: string; status?: string }> | null | undefined
): number {
  if (!factors?.length) return 0;
  return factors.filter(
    (factor) =>
      (factor.factor_type === 'totp' || !factor.factor_type) &&
      factor.status === 'verified'
  ).length;
}

/**
 * Decide whether a sensitive action may proceed.
 * Enrollment is required before AAL2/step-up can succeed.
 */
export function resolveSensitiveActionBlock(input: {
  verifiedTotpCount: number;
  currentLevel: string | null | undefined;
  methods: AmrEntry[] | null | undefined;
  nowSeconds?: number;
}): MfaStepUpCode | null {
  if (input.verifiedTotpCount < 1) {
    return 'MFA_ENROLLMENT_REQUIRED';
  }
  if (input.currentLevel !== 'aal2') {
    return 'MFA_CHALLENGE_REQUIRED';
  }
  if (!hasRecentTotpAmr(input.methods, input.nowSeconds)) {
    return 'STEP_UP_REQUIRED';
  }
  return null;
}

export function enrolledUserNeedsMfaChallenge(input: {
  verifiedTotpCount: number;
  currentLevel: string | null | undefined;
}): boolean {
  return input.verifiedTotpCount > 0 && input.currentLevel !== 'aal2';
}
