import {
  getPublicAssetBaseUrl,
  isR2CredentialsConfigured,
  isR2Configured,
  readStorageConfig,
  resolveStorageProvider,
  R2_PRODUCTION_ENV_MESSAGE,
} from '@/lib/storage/storage-config';

export type AgreementUploadStorageProvider = 'local' | 'r2';

export type AgreementR2StorageConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
  publicBaseUrl: string | null;
};

export function readAgreementUploadStorageProvider(
  processEnv: NodeJS.ProcessEnv = process.env
): AgreementUploadStorageProvider {
  const config = readStorageConfig(processEnv);
  const provider = resolveStorageProvider(config, processEnv);
  return provider === 'r2' ? 'r2' : 'local';
}

export function readAgreementR2StorageConfig(
  processEnv: NodeJS.ProcessEnv = process.env
): AgreementR2StorageConfig | null {
  const config = readStorageConfig(processEnv);
  if (!isR2CredentialsConfigured(config)) {
    return null;
  }

  return {
    accountId: config.r2.accountId!,
    accessKeyId: config.r2.accessKeyId!,
    secretAccessKey: config.r2.secretAccessKey!,
    bucketName: config.r2.bucketName!,
    endpoint: config.r2.endpoint ?? `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
    publicBaseUrl: getPublicAssetBaseUrl(config),
  };
}

export function requireAgreementR2StorageConfig(): AgreementR2StorageConfig {
  const config = readAgreementR2StorageConfig();
  if (!config) {
    throw new Error(`R2 agreement storage is misconfigured. ${R2_PRODUCTION_ENV_MESSAGE}`);
  }
  return config;
}

/** Whether agreement uploads can use R2 in the current environment. */
export function isAgreementR2StorageConfigured(
  processEnv: NodeJS.ProcessEnv = process.env
): boolean {
  return isR2Configured(readStorageConfig(processEnv));
}
