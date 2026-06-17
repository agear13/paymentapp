import {
  assertProductionEnvGuards,
  isCronBaseUrlValid,
  isCronSecretValid,
  isCsrfSecretValid,
  isStripeWebhookSecretValid,
} from '@/lib/config/production-env-guards';

const productionCronEnv = {
  CRON_SECRET: 'a'.repeat(16),
  CSRF_SECRET: 'a'.repeat(32),
  NEXT_PUBLIC_APP_URL: 'https://app.provvypay.com',
  STORAGE_PROVIDER: 'r2',
  R2_ACCOUNT_ID: 'account-id',
  R2_ACCESS_KEY_ID: 'access-key',
  R2_SECRET_ACCESS_KEY: 'secret-key',
  R2_BUCKET_NAME: 'provvypay-assets',
  R2_PUBLIC_URL: 'https://assets.provvypay.com',
};

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
        productionCronEnv
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
        productionCronEnv
      )
    ).toThrow(/sk_live_/);

    expect(() =>
      assertProductionEnvGuards(
        {
          ...validProductionEnv,
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_abc',
        },
        productionCronEnv
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
          ...productionCronEnv,
          ALLOW_STRIPE_TEST_KEYS: 'true',
        }
      )
    ).not.toThrow();
  });

  it('rejects missing cron base URL in production', () => {
    expect(isCronBaseUrlValid({})).toBe(false);
    expect(isCronBaseUrlValid({ NEXT_PUBLIC_APP_URL: 'https://app.provvypay.com' })).toBe(true);
    expect(isCronBaseUrlValid({ CRON_BASE_URL: 'https://app.provvypay.com' })).toBe(true);

    expect(() =>
      assertProductionEnvGuards(validProductionEnv, {
        CRON_SECRET: 'a'.repeat(16),
        CSRF_SECRET: 'a'.repeat(32),
      })
    ).toThrow(/CRON_BASE_URL or NEXT_PUBLIC_APP_URL/);
  });

  it('rejects missing CSRF_SECRET in production', () => {
    expect(isCsrfSecretValid(undefined)).toBe(false);
    expect(isCsrfSecretValid('short')).toBe(false);
    expect(isCsrfSecretValid('a'.repeat(32))).toBe(true);

    expect(() =>
      assertProductionEnvGuards(validProductionEnv, {
        ...productionCronEnv,
        CSRF_SECRET: '',
      })
    ).toThrow(/CSRF_SECRET/);
  });

  it('rejects agreement upload storage when production R2 credentials are missing', () => {
    expect(() =>
      assertProductionEnvGuards(validProductionEnv, {
        CRON_SECRET: 'a'.repeat(16),
        CSRF_SECRET: 'a'.repeat(32),
        NEXT_PUBLIC_APP_URL: 'https://app.provvypay.com',
        STORAGE_PROVIDER: 'r2',
        NODE_ENV: 'production',
      })
    ).toThrow(/R2_ACCOUNT_ID/);
  });

  it('passes valid production configuration', () => {
    expect(() =>
      assertProductionEnvGuards(validProductionEnv, productionCronEnv)
    ).not.toThrow();
  });
});
