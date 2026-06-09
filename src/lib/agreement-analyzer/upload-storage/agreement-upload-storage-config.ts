export type AgreementUploadStorageProvider = 'local' | 'r2';

export type AgreementR2StorageConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
  publicBaseUrl: string | null;
};

function trimOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function readAgreementUploadStorageProvider(): AgreementUploadStorageProvider {
  const raw = process.env.STORAGE_PROVIDER?.trim().toLowerCase();
  return raw === 'r2' ? 'r2' : 'local';
}

export function readAgreementR2StorageConfig(): AgreementR2StorageConfig | null {
  const accountId = trimOrNull(process.env.R2_ACCOUNT_ID);
  const accessKeyId = trimOrNull(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = trimOrNull(process.env.R2_SECRET_ACCESS_KEY);
  const bucketName = trimOrNull(process.env.R2_BUCKET_NAME);

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  const endpoint =
    trimOrNull(process.env.R2_ENDPOINT) ??
    `https://${accountId}.r2.cloudflarestorage.com`;

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    endpoint,
    publicBaseUrl: trimOrNull(process.env.R2_PUBLIC_BASE_URL),
  };
}

export function requireAgreementR2StorageConfig(): AgreementR2StorageConfig {
  const config = readAgreementR2StorageConfig();
  if (!config) {
    throw new Error(
      'R2 agreement storage is misconfigured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.'
    );
  }
  return config;
}
