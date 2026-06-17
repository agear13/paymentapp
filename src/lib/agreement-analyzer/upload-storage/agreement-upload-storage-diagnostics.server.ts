import 'server-only';

import {
  isAgreementR2StorageConfigured,
  readAgreementR2StorageConfig,
  readAgreementUploadStorageProvider,
  type AgreementUploadStorageProvider,
} from '@/lib/agreement-analyzer/upload-storage/agreement-upload-storage-config';
import { R2_PRODUCTION_ENV_MESSAGE } from '@/lib/storage/storage-config';
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
  const r2Ready = isAgreementR2StorageConfigured(processEnv);

  if (isProduction && !r2Ready) {
    return {
      provider,
      bucket: r2Config?.bucketName ?? null,
      environment,
      configured: false,
      misconfigured: true,
      reason: `Object storage is not configured for production. ${R2_PRODUCTION_ENV_MESSAGE}`,
    };
  }

  if (provider === 'r2' && !r2Config) {
    return {
      provider,
      bucket: null,
      environment,
      configured: false,
      misconfigured: true,
      reason: `Object storage credentials are incomplete. ${R2_PRODUCTION_ENV_MESSAGE}`,
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
