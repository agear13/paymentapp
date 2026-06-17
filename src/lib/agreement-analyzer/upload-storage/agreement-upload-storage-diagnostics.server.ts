import 'server-only';

import {
  readAgreementR2StorageConfig,
  readAgreementUploadStorageProvider,
  type AgreementUploadStorageProvider,
} from '@/lib/agreement-analyzer/upload-storage/agreement-upload-storage-config';
import { loggers } from '@/lib/logger';

export type AgreementStorageHealthStatus = {
  provider: AgreementUploadStorageProvider;
  bucket: string | null;
  environment: string;
  configured: boolean;
  misconfigured: boolean;
  reason: string | null;
};

export function evaluateAgreementStorageHealth(
  processEnv: NodeJS.ProcessEnv = process.env
): AgreementStorageHealthStatus {
  const environment = processEnv.NODE_ENV ?? 'development';
  const provider = readAgreementUploadStorageProvider(processEnv);
  const r2Config = readAgreementR2StorageConfig(processEnv);
  const isProduction = environment === 'production';

  if (isProduction && provider === 'local') {
    return {
      provider,
      bucket: null,
      environment,
      configured: false,
      misconfigured: true,
      reason:
        'Agreement uploads cannot use local filesystem in production. Set STORAGE_PROVIDER=r2 and configure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.',
    };
  }

  if (provider === 'r2' && !r2Config) {
    return {
      provider,
      bucket: null,
      environment,
      configured: false,
      misconfigured: true,
      reason:
        'STORAGE_PROVIDER=r2 requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.',
    };
  }

  return {
    provider,
    bucket: r2Config?.bucketName ?? null,
    environment,
    configured: provider === 'r2' ? Boolean(r2Config) : environment !== 'production',
    misconfigured: false,
    reason: null,
  };
}

let startupLogged = false;

export function logAgreementStorageStartup(
  processEnv: NodeJS.ProcessEnv = process.env
): AgreementStorageHealthStatus {
  const health = evaluateAgreementStorageHealth(processEnv);
  if (startupLogged) {
    return health;
  }
  startupLogged = true;

  loggers.jobs.info('[agreement-storage]', {
    provider: health.provider,
    bucket: health.bucket,
    environment: health.environment,
  });

  if (health.misconfigured && health.reason) {
    loggers.jobs.error('[agreement-storage] misconfigured', undefined, {
      provider: health.provider,
      bucket: health.bucket,
      environment: health.environment,
      reason: health.reason,
    });
  }

  return health;
}

export function resetAgreementStorageStartupLoggingForTests(): void {
  startupLogged = false;
}
