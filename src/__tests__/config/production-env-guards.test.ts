import {
  assertProductionEnvGuards,
  isCronSecretValid,
  isCsrfSecretValid,
  isStripeWebhookSecretValid,
} from '@/lib/config/production-env-guards';

const validProductionEnv = {
  NODE_ENV: 'production',
  STRIPE_SECRET_KEY: 'sk_live_abc123',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_abc123',
  STRIPE_WEBHOOK_SECRET: 'whsec_real_secret_value',
};

describe('production-env-guards (B5)', () => {
  it('skips guards outside production', () => {
    expect(() =>
      assertProductionEnvGuards(
        { ...validProductionEnv, NODE_ENV: 'development' },
        { CRON_SECRET: '' }
      )
    ).not.toThrow();
  });

  it('rejects disabled Stripe webhook secret (C1)', () => {
    expect(isStripeWebhookSecretValid('disabled')).toBe(false);
    expect(isStripeWebhookSecretValid('')).toBe(false);
    expect(isStripeWebhookSecretValid('whsec_ok')).toBe(true);

    expect(() =>
      assertProductionEnvGuards(
        { ...validProductionEnv, STRIPE_WEBHOOK_SECRET: 'disabled' },
        { CRON_SECRET: 'a'.repeat(16), CSRF_SECRET: 'a'.repeat(32) }
      )
    ).toThrow(/Production environment hardening failed/);
  });

  it('rejects missing CRON_SECRET in production (C3)', () => {
    expect(isCronSecretValid(undefined)).toBe(false);
    expect(isCronSecretValid('short')).toBe(false);
    expect(isCronSecretValid('a'.repeat(16))).toBe(true);

    expect(() =>
      assertProductionEnvGuards(validProductionEnv, { CRON_SECRET: '' })
    ).toThrow(/CRON_SECRET/);
  });

  it('rejects Stripe test keys in production (C5)', () => {
    expect(() =>
      assertProductionEnvGuards(
        {
          ...validProductionEnv,
          STRIPE_SECRET_KEY: 'sk_test_abc',
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_abc',
        },
        { CRON_SECRET: 'a'.repeat(16) }
      )
    ).toThrow(/sk_live_/);

    expect(() =>
      assertProductionEnvGuards(
        {
          ...validProductionEnv,
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_abc',
        },
        { CRON_SECRET: 'a'.repeat(16) }
      )
    ).toThrow(/pk_live_/);
  });

  it('allows test keys when ALLOW_STRIPE_TEST_KEYS=true (staging)', () => {
    expect(() =>
      assertProductionEnvGuards(
        {
          ...validProductionEnv,
          STRIPE_SECRET_KEY: 'sk_test_abc',
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_abc',
        },
        {
          CRON_SECRET: 'a'.repeat(16),
          CSRF_SECRET: 'a'.repeat(32),
          ALLOW_STRIPE_TEST_KEYS: 'true',
        }
      )
    ).not.toThrow();
  });

  it('rejects missing CSRF_SECRET in production', () => {
    expect(isCsrfSecretValid(undefined)).toBe(false);
    expect(isCsrfSecretValid('short')).toBe(false);
    expect(isCsrfSecretValid('a'.repeat(32))).toBe(true);

    expect(() =>
      assertProductionEnvGuards(validProductionEnv, {
        CRON_SECRET: 'a'.repeat(16),
        CSRF_SECRET: '',
      })
    ).toThrow(/CSRF_SECRET/);
  });

  it('passes valid production configuration', () => {
    expect(() =>
      assertProductionEnvGuards(validProductionEnv, {
        CRON_SECRET: 'secure-cron-secret-value',
        CSRF_SECRET: 'secure-csrf-secret-minimum-32-chars',
      })
    ).not.toThrow();
  });
});
