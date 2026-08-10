import { HeadBucketCommand } from '@aws-sdk/client-s3';

import {
  classifyR2ConnectivityFailure,
  extractSafeR2AwsErrorDiagnostics,
  getOperationalR2S3SigningEndpoint,
  probeR2BucketConnectivity,
  redactR2AccountId,
} from '@/lib/storage/r2-connectivity-diagnostics.server';
import { resetR2ClientCache } from '@/lib/storage/providers/r2-storage';
import type { StorageConfig } from '@/lib/storage/storage-config';
import { StorageServiceError } from '@/lib/storage/types';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  HeadBucketCommand: jest.fn().mockImplementation((input) => ({ input })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));

const baseConfig: StorageConfig = {
  provider: 'r2',
  r2: {
    accountId: '81ba3ac215bbde6352beec7e6ef28841',
    accessKeyId: 'access-key-id-value',
    secretAccessKey: 'secret-access-key-value',
    bucketName: 'provvypay-assets',
    publicUrl: 'https://81ba3ac215bbde6352beec7e6ef28841.r2.cloudflarestorage.com',
    endpoint: 'https://override.example.com',
  },
  assetCdnUrl: null,
  localUploadDir: 'public/uploads',
};

describe('r2 connectivity diagnostics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetR2ClientCache();
  });

  it('redacts account IDs to first 4 and last 4 characters', () => {
    expect(redactR2AccountId('81ba3ac215bbde6352beec7e6ef28841')).toBe('81ba…8841');
  });

  it('reports the operational signing endpoint from R2_ACCOUNT_ID only', () => {
    expect(getOperationalR2S3SigningEndpoint(baseConfig)).toBe(
      'https://81ba3ac215bbde6352beec7e6ef28841.r2.cloudflarestorage.com'
    );
  });

  it('classifies SignatureDoesNotMatch and redacts secrets from error messages', () => {
    const awsCause = Object.assign(
      new Error('Authorization: Bearer super-secret-token'),
      {
        name: 'SignatureDoesNotMatch',
        Code: 'SignatureDoesNotMatch',
        $metadata: { httpStatusCode: 403, requestId: 'req-123' },
      }
    );

    const diagnostics = extractSafeR2AwsErrorDiagnostics(
      new StorageServiceError('upload_failed', 'R2 upload failed', { cause: awsCause })
    );

    expect(classifyR2ConnectivityFailure(awsCause)).toBe('SignatureDoesNotMatch');
    expect(diagnostics.awsErrorCode).toBe('SignatureDoesNotMatch');
    expect(diagnostics.httpStatus).toBe(403);
    expect(diagnostics.requestId).toBe('req-123');
    expect(diagnostics.causeMessage).toBe('Authorization: [redacted]');
    expect(JSON.stringify(diagnostics)).not.toMatch(/secret-access-key/i);
    expect(JSON.stringify(diagnostics)).not.toMatch(/super-secret-token/);
  });

  it('probes bucket connectivity with HeadBucket and no object mutations', async () => {
    mockSend.mockResolvedValueOnce({});

    const result = await probeR2BucketConnectivity(baseConfig);

    expect(result.success).toBe(true);
    expect(result.operation).toBe('HeadBucket');
    expect(result.bucket).toBe('provvypay-assets');
    expect(result.s3SigningEndpointUsed).toBe(
      'https://81ba3ac215bbde6352beec7e6ef28841.r2.cloudflarestorage.com'
    );
    expect(result.configuredR2Endpoint).toBe('https://override.example.com');
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(HeadBucketCommand).toHaveBeenCalledWith({ Bucket: 'provvypay-assets' });
  });

  it('returns classified failure diagnostics when HeadBucket fails', async () => {
    mockSend.mockRejectedValueOnce(
      Object.assign(new Error('The request signature we calculated does not match'), {
        name: 'SignatureDoesNotMatch',
        Code: 'SignatureDoesNotMatch',
        $metadata: { httpStatusCode: 403, requestId: 'req-failed' },
      })
    );

    const result = await probeR2BucketConnectivity(baseConfig);

    expect(result.success).toBe(false);
    expect(result.failureClass).toBe('SignatureDoesNotMatch');
    expect(result.error?.awsErrorCode).toBe('SignatureDoesNotMatch');
    expect(result.error?.httpStatus).toBe(403);
    expect(result.error?.requestId).toBe('req-failed');
  });
});
