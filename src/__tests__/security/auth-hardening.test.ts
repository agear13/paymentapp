import { isDisposableEmail, extractEmailDomain } from '@/lib/auth/disposable-email';
import { validatePassword, MIN_PASSWORD_LENGTH } from '@/lib/auth/password-policy';
import { isEmailVerified } from '@/lib/auth/email-verification';
import { evaluateSuspiciousLogin } from '@/lib/auth/suspicious-login.server';

describe('password policy', () => {
  it('requires at least 12 characters', () => {
    expect(validatePassword('short')).toEqual({
      valid: false,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    });
  });

  it('rejects common passwords', () => {
    expect(validatePassword('password123456')).toEqual({
      valid: false,
      message: 'This password is too common. Please choose a stronger password.',
    });
  });

  it('accepts strong passwords', () => {
    expect(validatePassword('correct-horse-battery-staple')).toEqual({ valid: true });
  });
});

describe('disposable email detection', () => {
  it('blocks known disposable domains', () => {
    expect(isDisposableEmail('test@mailinator.com')).toBe(true);
    expect(isDisposableEmail('user@guerrillamail.com')).toBe(true);
  });

  it('allows regular domains', () => {
    expect(isDisposableEmail('user@company.com')).toBe(false);
  });

  it('extracts domain safely', () => {
    expect(extractEmailDomain('User@Example.COM')).toBe('example.com');
  });
});

describe('email verification helper', () => {
  it('treats confirmed email users as verified', () => {
    expect(
      isEmailVerified({
        email_confirmed_at: '2026-01-01T00:00:00Z',
        app_metadata: { provider: 'email' },
      })
    ).toBe(true);
  });

  it('treats oauth users as verified', () => {
    expect(
      isEmailVerified({
        email_confirmed_at: null,
        app_metadata: { provider: 'google' },
      })
    ).toBe(true);
  });

  it('treats unconfirmed email users as unverified', () => {
    expect(
      isEmailVerified({
        email_confirmed_at: null,
        app_metadata: { provider: 'email' },
      })
    ).toBe(false);
  });
});

describe('suspicious login detection', () => {
  it('flags impossible travel within two hours', () => {
    const now = new Date('2026-06-24T12:00:00Z');
    const result = evaluateSuspiciousLogin({
      userId: 'user-1',
      previousLocation: 'Australia',
      previousLoginAt: new Date('2026-06-24T11:30:00Z'),
      currentLocation: 'Germany',
      now,
    });
    expect(result.suspicious).toBe(true);
    expect(result.ruleId).toBe('impossible_travel');
  });

  it('does not flag same-region logins', () => {
    const result = evaluateSuspiciousLogin({
      userId: 'user-1',
      previousLocation: 'Australia',
      previousLoginAt: new Date('2026-06-24T11:30:00Z'),
      currentLocation: 'Australia',
    });
    expect(result.suspicious).toBe(false);
  });
});
