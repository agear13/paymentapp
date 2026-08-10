import 'server-only';

import { HeadBucketCommand } from '@aws-sdk/client-s3';

import { createR2Client } from '@/lib/storage/providers/r2-storage';
import { readStorageConfig, type StorageConfig } from '@/lib/storage/storage-config';
import { StorageServiceError } from '@/lib/storage/types';

export type R2ConnectivityFailureClass =
  | 'SignatureDoesNotMatch'
  | 'AccessDenied'
  | 'InvalidAccessKeyId'
  | 'NoSuchBucket'
  | 'other';

export type SafeR2AwsErrorDiagnostics = {
  errorName?: string;
  errorMessage?: string;
  awsErrorCode?: string;
  httpStatus?: number;
  requestId?: string;
  causeName?: string;
  causeMessage?: string;
};

export type R2ConnectivityProbeResult = {
  success: boolean;
  provider: 'r2';
  operation: 'HeadBucket';
  bucket: string | null;
  accountIdRedacted: string | null;
  /** Endpoint actually used by createR2Client (logo upload path). */
  s3SigningEndpointUsed: string | null;
  /** Endpoint from readStorageConfig (may reflect R2_ENDPOINT env). Not used for logo PutObject. */
  configuredR2Endpoint: string | null;
  region: 'auto';
  failureClass?: R2ConnectivityFailureClass;
  error?: SafeR2AwsErrorDiagnostics;
};

const DIAGNOSTIC_MESSAGE_MAX_LENGTH = 500;

function redactDiagnosticString(value: string): string {
  let redacted = value
    .replace(/authorization\s*:\s*[^\s,;]+(?:\s+[^\s,;]+)*/gi, 'Authorization: [redacted]')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [redacted]')
    .replace(/AWS4-HMAC-SHA256\s+Credential=[^,\s]+/gi, 'AWS4-HMAC-SHA256 Credential=[redacted]')
    .replace(/\b(AKIA[0-9A-Z]{16})\b/g, '[redacted-access-key]')
    .replace(/\b(secret[_-]?access[_-]?key\s*[:=]\s*)\S+/gi, '$1[redacted]')
    .replace(/\b(R2_SECRET_ACCESS_KEY\s*[:=]\s*)\S+/gi, '$1[redacted]');

  if (redacted.length > DIAGNOSTIC_MESSAGE_MAX_LENGTH) {
    redacted = `${redacted.slice(0, DIAGNOSTIC_MESSAGE_MAX_LENGTH)}…`;
  }

  return redacted;
}

export function redactR2AccountId(accountId: string | null | undefined): string | null {
  if (!accountId) return null;
  const trimmed = accountId.trim();
  if (trimmed.length <= 8) return '[redacted]';
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

/** Endpoint passed to S3Client by the operational R2 provider (logo uploads). */
export function getOperationalR2S3SigningEndpoint(
  config: StorageConfig = readStorageConfig()
): string | null {
  if (!config.r2.accountId) return null;
  return `https://${config.r2.accountId}.r2.cloudflarestorage.com`;
}

function readAwsLikeErrorFields(error: unknown): SafeR2AwsErrorDiagnostics {
  if (!error || typeof error !== 'object') {
    return {};
  }

  const record = error as Record<string, unknown>;
  const metadata =
    record.$metadata && typeof record.$metadata === 'object'
      ? (record.$metadata as Record<string, unknown>)
      : undefined;

  const errorName = typeof record.name === 'string' ? redactDiagnosticString(record.name) : undefined;
  const errorMessage =
    typeof record.message === 'string' ? redactDiagnosticString(record.message) : undefined;

  const awsErrorCode =
    typeof record.Code === 'string'
      ? redactDiagnosticString(record.Code)
      : errorName && errorName !== 'Error'
        ? errorName
        : undefined;

  return {
    errorName,
    errorMessage,
    awsErrorCode,
    httpStatus: typeof metadata?.httpStatusCode === 'number' ? metadata.httpStatusCode : undefined,
    requestId:
      typeof metadata?.requestId === 'string'
        ? redactDiagnosticString(metadata.requestId)
        : undefined,
  };
}

export function extractSafeR2AwsErrorDiagnostics(error: unknown): SafeR2AwsErrorDiagnostics {
  if (error instanceof StorageServiceError && error.cause) {
    const causeFields = readAwsLikeErrorFields(error.cause);
    return {
      errorName: error.name,
      errorMessage: redactDiagnosticString(error.message),
      awsErrorCode: causeFields.awsErrorCode,
      httpStatus: causeFields.httpStatus,
      requestId: causeFields.requestId,
      causeName: causeFields.errorName,
      causeMessage: causeFields.errorMessage,
    };
  }

  const fields = readAwsLikeErrorFields(error);
  return {
    errorName: fields.errorName,
    errorMessage: fields.errorMessage,
    awsErrorCode: fields.awsErrorCode,
    httpStatus: fields.httpStatus,
    requestId: fields.requestId,
    causeName: fields.errorName,
    causeMessage: fields.errorMessage,
  };
}

export function classifyR2ConnectivityFailure(error: unknown): R2ConnectivityFailureClass {
  const fields = extractSafeR2AwsErrorDiagnostics(error);
  const code = `${fields.awsErrorCode ?? ''} ${fields.causeName ?? ''} ${fields.errorName ?? ''}`
    .trim()
    .toLowerCase();

  if (code.includes('signaturedoesnotmatch')) return 'SignatureDoesNotMatch';
  if (code.includes('accessdenied')) return 'AccessDenied';
  if (code.includes('invalidaccesskeyid')) return 'InvalidAccessKeyId';
  if (code.includes('nosuchbucket')) return 'NoSuchBucket';
  return 'other';
}

function buildProbeMetadata(config: StorageConfig): Pick<
  R2ConnectivityProbeResult,
  'provider' | 'operation' | 'bucket' | 'accountIdRedacted' | 's3SigningEndpointUsed' | 'configuredR2Endpoint' | 'region'
> {
  return {
    provider: 'r2',
    operation: 'HeadBucket',
    bucket: config.r2.bucketName,
    accountIdRedacted: redactR2AccountId(config.r2.accountId),
    s3SigningEndpointUsed: getOperationalR2S3SigningEndpoint(config),
    configuredR2Endpoint: config.r2.endpoint,
    region: 'auto',
  };
}

/**
 * Harmless R2 connectivity probe using the same S3Client as logo uploads.
 * Performs HeadBucket only — no object reads/writes/deletes.
 */
export async function probeR2BucketConnectivity(
  config: StorageConfig = readStorageConfig()
): Promise<R2ConnectivityProbeResult> {
  const metadata = buildProbeMetadata(config);

  if (
    !config.r2.accountId ||
    !config.r2.accessKeyId ||
    !config.r2.secretAccessKey ||
    !config.r2.bucketName
  ) {
    const error = new StorageServiceError('misconfigured', 'R2 storage is not configured');
    return {
      success: false,
      ...metadata,
      failureClass: 'other',
      error: extractSafeR2AwsErrorDiagnostics(error),
    };
  }

  const client = createR2Client(config);
  const bucket = config.r2.bucketName;

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return {
      success: true,
      ...metadata,
    };
  } catch (error: unknown) {
    return {
      success: false,
      ...metadata,
      failureClass: classifyR2ConnectivityFailure(error),
      error: extractSafeR2AwsErrorDiagnostics(error),
    };
  }
}
