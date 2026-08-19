import {
  countVerifiedTotpFactors,
  hasRecentTotpAmr,
  hasRecoveryAmr,
  resolveSensitiveActionBlock,
  enrolledUserNeedsMfaChallenge,
} from '@/lib/auth/mfa-assurance';

describe('MFA assurance helpers', () => {
  const now = 1_700_000_000;

  it('counts only verified TOTP factors', () => {
    expect(
      countVerifiedTotpFactors([
        { factor_type: 'totp', status: 'verified' },
        { factor_type: 'totp', status: 'unverified' },
        { factor_type: 'phone', status: 'verified' },
      ])
    ).toBe(1);
  });

  it('requires enrollment before any sensitive payment configuration change', () => {
    expect(
      resolveSensitiveActionBlock({
        verifiedTotpCount: 0,
        currentLevel: 'aal1',
        methods: [{ method: 'password', timestamp: now }],
        nowSeconds: now,
      })
    ).toBe('MFA_ENROLLMENT_REQUIRED');
  });

  it('requires a challenge when enrolled but still at AAL1', () => {
    expect(
      resolveSensitiveActionBlock({
        verifiedTotpCount: 1,
        currentLevel: 'aal1',
        methods: [{ method: 'password', timestamp: now }],
        nowSeconds: now,
      })
    ).toBe('MFA_CHALLENGE_REQUIRED');
  });

  it('requires recent TOTP even when currentLevel is aal2', () => {
    expect(
      resolveSensitiveActionBlock({
        verifiedTotpCount: 1,
        currentLevel: 'aal2',
        methods: [
          { method: 'password', timestamp: now - 60 },
          { method: 'totp', timestamp: now - 601 },
        ],
        nowSeconds: now,
      })
    ).toBe('STEP_UP_REQUIRED');
  });

  it('allows a protected change with AAL2 and recent TOTP', () => {
    expect(
      resolveSensitiveActionBlock({
        verifiedTotpCount: 1,
        currentLevel: 'aal2',
        methods: [
          { method: 'password', timestamp: now - 60 },
          { method: 'totp', timestamp: now - 30 },
        ],
        nowSeconds: now,
      })
    ).toBeNull();
  });

  it('treats totp AMR as recent within the step-up window', () => {
    expect(hasRecentTotpAmr([{ method: 'totp', timestamp: now - 599 }], now, 600)).toBe(true);
    expect(hasRecentTotpAmr([{ method: 'password', timestamp: now }], now, 600)).toBe(false);
  });

  it('does not treat a password-only session as an MFA challenge satisfaction', () => {
    expect(
      enrolledUserNeedsMfaChallenge({
        verifiedTotpCount: 1,
        currentLevel: 'aal1',
      })
    ).toBe(true);
  });

  it('recognizes recovery AMR for password-reset completion only', () => {
    expect(hasRecoveryAmr([{ method: 'recovery', timestamp: now }])).toBe(true);
    expect(hasRecoveryAmr([{ method: 'password', timestamp: now }])).toBe(false);
  });
});
