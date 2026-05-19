/**
 * Cloudflare R2 storage provider (S3-compatible).
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import type { StorageConfig } from '@/lib/storage/storage-config';
import { StorageServiceError } from '@/lib/storage/types';

export type R2UploadInput = {
  storageKey: string;
  bytes: Buffer;
  mimeType: string;
  visibility: 'public' | 'private';
};

let cachedClient: S3Client | null = null;
let cachedConfigKey: string | null = null;

function configKey(config: StorageConfig): string {
  return [
    config.r2.accountId,
    config.r2.accessKeyId,
    config.r2.bucketName,
  ].join(':');
}

export function createR2Client(config: StorageConfig): S3Client {
  const key = configKey(config);
  if (cachedClient && cachedConfigKey === key) {
    return cachedClient;
  }

  if (
    !config.r2.accountId ||
    !config.r2.accessKeyId ||
    !config.r2.secretAccessKey ||
    !config.r2.bucketName
  ) {
    throw new StorageServiceError(
      'misconfigured',
      'R2 storage is not configured'
    );
  }

  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
    },
  });
  cachedConfigKey = key;
  return cachedClient;
}

export async function r2UploadObject(
  config: StorageConfig,
  input: R2UploadInput
): Promise<void> {
  const client = createR2Client(config);
  const bucket = config.r2.bucketName!;

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: input.storageKey,
        Body: input.bytes,
        ContentType: input.mimeType,
        CacheControl: input.visibility === 'public' ? 'public, max-age=31536000, immutable' : 'private, no-store',
      })
    );
  } catch (error) {
    throw new StorageServiceError('upload_failed', 'R2 upload failed', { cause: error });
  }
}

export async function r2DownloadObject(
  config: StorageConfig,
  storageKey: string
): Promise<Buffer> {
  const client = createR2Client(config);
  const bucket = config.r2.bucketName!;

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: storageKey,
      })
    );

    if (!response.Body) {
      throw new StorageServiceError('download_failed', 'R2 object body missing');
    }

    const bytes = Buffer.from(await response.Body.transformToByteArray());
    return bytes;
  } catch (error) {
    if (error instanceof StorageServiceError) throw error;
    throw new StorageServiceError('download_failed', 'R2 download failed', { cause: error });
  }
}

export async function r2DeleteObject(
  config: StorageConfig,
  storageKey: string
): Promise<void> {
  const client = createR2Client(config);
  const bucket = config.r2.bucketName!;

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: storageKey,
      })
    );
  } catch (error) {
    throw new StorageServiceError('delete_failed', 'R2 delete failed', { cause: error });
  }
}

export function r2PublicUrlForKey(
  config: StorageConfig,
  storageKey: string
): string | null {
  const base = config.assetCdnUrl ?? config.r2.publicUrl;
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}/${storageKey.replace(/^\/+/, '')}`;
}

/** Reset cached client — test helper. */
export function resetR2ClientCache(): void {
  cachedClient = null;
  cachedConfigKey = null;
}
