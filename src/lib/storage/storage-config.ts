/**
 * Canonical storage provider configuration and startup health checks.
 * Used by operational asset storage (logos, attachments) and agreement upload storage.
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
    endpoint: string | null;
  };
  assetCdnUrl: string | null;
  localUploadDir: string;
};

export const R2_PRODUCTION_ENV_MESSAGE =
  'Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL.';

function trimOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function readStorageConfig(
  processEnv: NodeJS.ProcessEnv = process.env
): StorageConfig {
  const accountId = trimOrNull(processEnv.R2_ACCOUNT_ID);
  const endpoint =
    trimOrNull(processEnv.R2_ENDPOINT) ??
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null);

  const r2 = {
    accountId,
    accessKeyId: trimOrNull(processEnv.R2_ACCESS_KEY_ID),
    secretAccessKey: trimOrNull(processEnv.R2_SECRET_ACCESS_KEY),
    bucketName: trimOrNull(processEnv.R2_BUCKET_NAME),
    publicUrl:
      trimOrNull(processEnv.R2_PUBLIC_URL) ?? trimOrNull(processEnv.R2_PUBLIC_BASE_URL),
    endpoint,
  };

  const config: StorageConfig = {
    provider: 'local',
    r2,
    assetCdnUrl: trimOrNull(processEnv.ASSET_CDN_URL),
    localUploadDir: 'public/uploads',
  };

  config.provider = resolveStorageProvider(config, processEnv);
  return config;
}

export function isR2CredentialsConfigured(
  config: StorageConfig = readStorageConfig()
): boolean {
  return Boolean(
    config.r2.accountId &&
      config.r2.accessKeyId &&
      config.r2.secretAccessKey &&
      config.r2.bucketName
  );
}

export function isR2Configured(config: StorageConfig = readStorageConfig()): boolean {
  return isR2CredentialsConfigured(config) && Boolean(config.r2.publicUrl);
}

export function resolveStorageProvider(
  config: StorageConfig,
  processEnv: NodeJS.ProcessEnv = process.env
): StorageProviderName {
  const explicit = processEnv.STORAGE_PROVIDER?.trim().toLowerCase();
  const isProduction = processEnv.NODE_ENV === 'production';
  const isTest = processEnv.NODE_ENV === 'test';
  const allowLocal =
    !isProduction &&
    !isTest &&
    processEnv.STORAGE_ALLOW_LOCAL_FALLBACK !== 'false';

  if (explicit === 'local' && !isProduction) {
    return 'local';
  }

  if (isR2Configured(config)) {
    return 'r2';
  }

  if (explicit === 'r2' || (!allowLocal && isProduction)) {
    return 'r2';
  }

  return 'local';
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
      `R2 storage is not fully configured in production. Uploads will fail until ${R2_PRODUCTION_ENV_MESSAGE}`
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

/** Reset startup logging — test helper. */
export function resetStorageStartupLoggingForTests(): void {
  startupLogged = false;
}
