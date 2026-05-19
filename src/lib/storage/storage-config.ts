/**
 * Storage provider configuration and startup health checks.
 */

import type { StorageHealthStatus, StorageProviderName } from '@/lib/storage/types';

export type StorageConfig = {
  provider: StorageProviderName;
  r2: {
    accountId: string | null;
    accessKeyId: string | null;
    secretAccessKey: string | null;
    bucketName: string | null;
    publicUrl: string | null;
  };
  assetCdnUrl: string | null;
  localUploadDir: string;
};

function trimOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function readStorageConfig(): StorageConfig {
  const r2 = {
    accountId: trimOrNull(process.env.R2_ACCOUNT_ID),
    accessKeyId: trimOrNull(process.env.R2_ACCESS_KEY_ID),
    secretAccessKey: trimOrNull(process.env.R2_SECRET_ACCESS_KEY),
    bucketName: trimOrNull(process.env.R2_BUCKET_NAME),
    publicUrl: trimOrNull(process.env.R2_PUBLIC_URL),
  };

  const r2Configured = Boolean(
    r2.accountId &&
      r2.accessKeyId &&
      r2.secretAccessKey &&
      r2.bucketName &&
      r2.publicUrl
  );

  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  const allowLocal =
    !isProduction &&
    !isTest &&
    process.env.STORAGE_ALLOW_LOCAL_FALLBACK !== 'false';

  let provider: StorageProviderName = 'local';
  if (r2Configured) {
    provider = 'r2';
  } else if (!allowLocal && isProduction) {
    provider = 'r2';
  }

  return {
    provider,
    r2,
    assetCdnUrl: trimOrNull(process.env.ASSET_CDN_URL),
    localUploadDir: 'public/uploads',
  };
}

export function isR2Configured(config: StorageConfig = readStorageConfig()): boolean {
  return Boolean(
    config.r2.accountId &&
      config.r2.accessKeyId &&
      config.r2.secretAccessKey &&
      config.r2.bucketName &&
      config.r2.publicUrl
  );
}

export function getPublicAssetBaseUrl(config: StorageConfig = readStorageConfig()): string | null {
  return config.assetCdnUrl ?? config.r2.publicUrl;
}

export function evaluateStorageHealth(
  config: StorageConfig = readStorageConfig()
): StorageHealthStatus {
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';
  const r2Ready = isR2Configured(config);

  if (isProduction && !r2Ready) {
    warnings.push(
      'R2 storage is not fully configured in production. Uploads will fail until R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL are set.'
    );
  }

  if (!isProduction && !r2Ready) {
    warnings.push(
      'R2 not configured — using local filesystem storage fallback for development only.'
    );
  }

  if (r2Ready && !config.r2.publicUrl?.startsWith('https://')) {
    warnings.push('R2_PUBLIC_URL should use HTTPS in production.');
  }

  return {
    configured: isProduction ? r2Ready : r2Ready || config.provider === 'local',
    provider: r2Ready ? 'r2' : config.provider === 'local' ? 'local' : 'none',
    publicBaseUrl: getPublicAssetBaseUrl(config),
    warnings,
  };
}

let startupLogged = false;

export function logStorageStartupHealth(): StorageHealthStatus {
  const health = evaluateStorageHealth();
  if (startupLogged) return health;
  startupLogged = true;

  const payload = {
    context: 'storage.startup',
    configured: health.configured,
    provider: health.provider,
    publicBaseUrl: health.publicBaseUrl,
    warnings: health.warnings,
  };

  if (health.warnings.length > 0) {
    console.warn('[StorageService]', payload);
  } else {
    console.info('[StorageService]', payload);
  }

  return health;
}
