import {
  evaluateAgreementStorageHealth,
  logAgreementStorageStartup,
  resetAgreementStorageStartupLoggingForTests,
} from '@/lib/agreement-analyzer/upload-storage/agreement-upload-storage-diagnostics.server';
import { isAgreementStorageProductionReady } from '@/lib/config/production-env-guards';

describe('agreement upload storage diagnostics', () => {
  const r2Env = {
    NODE_ENV: 'production',
    STORAGE_PROVIDER: 'r2',
    R2_ACCOUNT_ID: 'account-id',
    R2_ACCESS_KEY_ID: 'access-key',
    R2_SECRET_ACCESS_KEY: 'secret-key',
    R2_BUCKET_NAME: 'provvypay-assets',
  };

  beforeEach(() => {
    resetAgreementStorageStartupLoggingForTests();
    delete process.env.STORAGE_PROVIDER;
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.NODE_ENV;
  });

  it('reports misconfiguration when production has no durable storage configured', () => {
    const env = { NODE_ENV: 'production' };

    const health = evaluateAgreementStorageHealth(env);

    expect(health).toMatchObject({
      provider: 'r2',
      misconfigured: true,
      configured: false,
    });
    expect(health.reason).toContain('R2_ACCOUNT_ID');
  });

  it('reports healthy R2 configuration in production', () => {
    Object.assign(process.env, r2Env);

    const health = evaluateAgreementStorageHealth(process.env);

    expect(health).toMatchObject({
      provider: 'r2',
      bucket: 'provvypay-assets',
      environment: 'production',
      configured: true,
      misconfigured: false,
    });
  });

  it('logs startup diagnostics once', () => {
    Object.assign(process.env, r2Env);

    const first = logAgreementStorageStartup(process.env);
    const second = logAgreementStorageStartup(process.env);

    expect(first.provider).toBe('r2');
    expect(second.provider).toBe('r2');
  });

  it('blocks production startup when agreement storage is not configured for R2', () => {
    expect(
      isAgreementStorageProductionReady({ NODE_ENV: 'production' }, { nodeEnv: 'production' })
    ).toEqual({
      ok: false,
      reason: expect.stringContaining('R2_ACCOUNT_ID'),
    });
  });
});
