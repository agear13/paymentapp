import {
  evaluateStorageHealth,
  getPublicAssetBaseUrl,
  isR2S3ApiEndpointUrl,
  readStorageConfig,
} from '@/lib/storage/storage-config';

describe('storage-config public asset URLs', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses R2_PUBLIC_URL as the public asset base URL', () => {
    process.env.R2_PUBLIC_URL = 'https://assets.provvypay.com';
    process.env.R2_ACCOUNT_ID = '81ba3ac215bbde6352beec7e6ef28841';
    process.env.R2_ACCESS_KEY_ID = 'access-key';
    process.env.R2_SECRET_ACCESS_KEY = 'secret-key';
    process.env.R2_BUCKET_NAME = 'provvypay-assets';

    const config = readStorageConfig();
    expect(getPublicAssetBaseUrl(config)).toBe('https://assets.provvypay.com');
  });

  it('detects R2 S3 API hostnames', () => {
    expect(
      isR2S3ApiEndpointUrl('https://81ba3ac215bbde6352beec7e6ef28841.r2.cloudflarestorage.com')
    ).toBe(true);
    expect(isR2S3ApiEndpointUrl('https://assets.provvypay.com')).toBe(false);
  });

  it('warns when R2_PUBLIC_URL uses the S3 API endpoint', () => {
    process.env.NODE_ENV = 'production';
    process.env.R2_PUBLIC_URL =
      'https://81ba3ac215bbde6352beec7e6ef28841.r2.cloudflarestorage.com';
    process.env.R2_ACCOUNT_ID = '81ba3ac215bbde6352beec7e6ef28841';
    process.env.R2_ACCESS_KEY_ID = 'access-key';
    process.env.R2_SECRET_ACCESS_KEY = 'secret-key';
    process.env.R2_BUCKET_NAME = 'provvypay-assets';

    const health = evaluateStorageHealth();
    expect(health.publicBaseUrl).toContain('r2.cloudflarestorage.com');
    expect(health.warnings.some((w) => w.includes('custom domain'))).toBe(true);
  });

  it('does not warn when R2_PUBLIC_URL uses the production custom domain', () => {
    process.env.NODE_ENV = 'production';
    process.env.R2_PUBLIC_URL = 'https://assets.provvypay.com';
    process.env.R2_ACCOUNT_ID = '81ba3ac215bbde6352beec7e6ef28841';
    process.env.R2_ACCESS_KEY_ID = 'access-key';
    process.env.R2_SECRET_ACCESS_KEY = 'secret-key';
    process.env.R2_BUCKET_NAME = 'provvypay-assets';

    const health = evaluateStorageHealth();
    expect(health.publicBaseUrl).toBe('https://assets.provvypay.com');
    expect(health.warnings.some((w) => w.includes('custom domain'))).toBe(false);
  });
});
