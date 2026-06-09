import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';

import type { AgreementR2StorageConfig } from '@/lib/agreement-analyzer/upload-storage/agreement-upload-storage-config';
import { emitAgreementUploadStored } from '@/lib/agreement-analyzer/upload-storage/emit-upload-stored.server';
import type {
  AgreementUploadDownloadResult,
  AgreementUploadStorageInput,
  AgreementUploadStorageResult,
  UploadStorageService,
} from '@/lib/agreement-analyzer/upload-storage/types';
import { UploadStorageError } from '@/lib/agreement-analyzer/upload-storage/types';
import { assertValidAgreementStorageKey } from '@/lib/agreement-analyzer/upload-storage/validate-storage-key';

let cachedClient: S3Client | null = null;
let cachedClientKey: string | null = null;

function clientCacheKey(config: AgreementR2StorageConfig): string {
  return [config.endpoint, config.accessKeyId, config.bucketName].join(':');
}

export function createAgreementR2Client(config: AgreementR2StorageConfig): S3Client {
  const key = clientCacheKey(config);
  if (cachedClient && cachedClientKey === key) {
    return cachedClient;
  }

  cachedClient = new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  cachedClientKey = key;
  return cachedClient;
}

export function resetAgreementR2ClientCache(): void {
  cachedClient = null;
  cachedClientKey = null;
}

function mapR2Error(error: unknown, fallbackCode: UploadStorageError['code']): UploadStorageError {
  if (error instanceof UploadStorageError) {
    return error;
  }

  if (error instanceof NoSuchKey) {
    return new UploadStorageError('not_found', 'Agreement file not found in R2', { cause: error });
  }

  if (error instanceof S3ServiceException) {
    const status = error.$metadata?.httpStatusCode;
    const code = error.name?.toLowerCase() ?? '';

    if (status === 404 || code.includes('notfound') || code.includes('nosuchkey')) {
      return new UploadStorageError('not_found', 'Agreement file not found in R2', { cause: error });
    }

    if (status === 403 || code.includes('accessdenied') || code.includes('invalidaccesskey')) {
      return new UploadStorageError('misconfigured', 'R2 authentication failed', { cause: error });
    }

    if (code.includes('timeout') || code.includes('network')) {
      return new UploadStorageError(fallbackCode, 'R2 request timed out', { cause: error });
    }
  }

  return new UploadStorageError(fallbackCode, 'R2 storage operation failed', { cause: error });
}

export class R2AgreementUploadStorage implements UploadStorageService {
  constructor(private readonly config: AgreementR2StorageConfig) {}

  async upload(input: AgreementUploadStorageInput): Promise<AgreementUploadStorageResult> {
    const storageKey = assertValidAgreementStorageKey(input.storageKey);
    const client = createAgreementR2Client(this.config);

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: this.config.bucketName,
          Key: storageKey,
          Body: input.bytes,
          ContentType: input.mimeType,
          ContentLength: input.bytes.length,
          CacheControl: 'private, no-store',
          Metadata: input.originalFilename
            ? { originalfilename: input.originalFilename }
            : undefined,
        })
      );

      emitAgreementUploadStored({
        provider: 'r2',
        fileSize: input.bytes.length,
        mimeType: input.mimeType,
      });

      return { storageKey };
    } catch (error) {
      throw mapR2Error(error, 'upload_failed');
    }
  }

  async download(storageKey: string): Promise<AgreementUploadDownloadResult> {
    const safeKey = assertValidAgreementStorageKey(storageKey);
    const client = createAgreementR2Client(this.config);

    try {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: this.config.bucketName,
          Key: safeKey,
        })
      );

      if (!response.Body) {
        throw new UploadStorageError('not_found', 'Agreement file not found in R2');
      }

      const bytes = Buffer.from(await response.Body.transformToByteArray());

      return {
        storageKey: safeKey,
        bytes,
        mimeType: response.ContentType ?? undefined,
        filename: response.Metadata?.originalfilename ?? undefined,
      };
    } catch (error) {
      throw mapR2Error(error, 'upload_failed');
    }
  }

  async delete(storageKey: string): Promise<void> {
    const safeKey = assertValidAgreementStorageKey(storageKey);
    const client = createAgreementR2Client(this.config);

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: this.config.bucketName,
          Key: safeKey,
        })
      );
    } catch (error) {
      throw mapR2Error(error, 'delete_failed');
    }
  }
}
