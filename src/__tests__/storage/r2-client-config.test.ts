import { S3Client } from '@aws-sdk/client-s3';

import { createAgreementR2Client, resetAgreementR2ClientCache } from '@/lib/agreement-analyzer/upload-storage/r2-agreement-upload-storage';
import { createR2Client, resetR2ClientCache } from '@/lib/storage/providers/r2-storage';
import type { StorageConfig } from '@/lib/storage/storage-config';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));

const MockS3Client = S3Client as jest.MockedClass<typeof S3Client>;

const expectedChecksumConfig = {
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
};

describe('R2 S3Client checksum compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetR2ClientCache();
    resetAgreementR2ClientCache();
  });

  it('configures operational R2 client with WHEN_REQUIRED checksum settings', () => {
    const config: StorageConfig = {
      provider: 'r2',
      r2: {
        accountId: 'account-id',
        accessKeyId: 'access-key',
        secretAccessKey: 'secret-key',
        bucketName: 'provvypay-assets',
        publicUrl: 'https://assets.example.com',
        endpoint: 'https://account-id.r2.cloudflarestorage.com',
      },
      assetCdnUrl: null,
      localUploadDir: 'public/uploads',
    };

    createR2Client(config);

    expect(MockS3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'auto',
        endpoint: 'https://account-id.r2.cloudflarestorage.com',
        credentials: {
          accessKeyId: 'access-key',
          secretAccessKey: 'secret-key',
        },
        ...expectedChecksumConfig,
      })
    );
  });

  it('configures agreement R2 client with WHEN_REQUIRED checksum settings', () => {
    createAgreementR2Client({
      accountId: 'account-id',
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
      bucketName: 'agreements-private',
      endpoint: 'https://account-id.r2.cloudflarestorage.com',
      publicBaseUrl: null,
    });

    expect(MockS3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'auto',
        endpoint: 'https://account-id.r2.cloudflarestorage.com',
        credentials: {
          accessKeyId: 'access-key',
          secretAccessKey: 'secret-key',
        },
        ...expectedChecksumConfig,
      })
    );
  });
});
