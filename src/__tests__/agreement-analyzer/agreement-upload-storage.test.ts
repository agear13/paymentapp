import { mkdtemp, readFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';

import { NoSuchKey } from '@aws-sdk/client-s3';

import {
  readAgreementR2StorageConfig,
  readAgreementUploadStorageProvider,
} from '@/lib/agreement-analyzer/upload-storage/agreement-upload-storage-config';
import { HybridAgreementUploadStorage } from '@/lib/agreement-analyzer/upload-storage/hybrid-agreement-upload-storage';
import {
  getAgreementUploadStorage,
  resetAgreementUploadStorageForTests,
} from '@/lib/agreement-analyzer/upload-storage/index';
import { LocalAgreementUploadStorage } from '@/lib/agreement-analyzer/upload-storage/local-upload-storage';
import {
  R2AgreementUploadStorage,
  resetAgreementR2ClientCache,
} from '@/lib/agreement-analyzer/upload-storage/r2-agreement-upload-storage';
import { UploadStorageError } from '@/lib/agreement-analyzer/upload-storage/types';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  class MockNoSuchKey extends Error {
    name = 'NoSuchKey';
  }

  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    NoSuchKey: MockNoSuchKey,
    S3ServiceException: class S3ServiceException extends Error {
      $metadata = { httpStatusCode: 500 };
    },
  };
});

jest.mock('@/lib/agreement-analyzer/upload-storage/emit-upload-stored.server', () => ({
  emitAgreementUploadStored: jest.fn(),
}));

describe('agreement upload storage', () => {
  const storageKey = 'agreements/2026/06/test-file.pdf';
  const bytes = Buffer.from('sample agreement bytes');
  const r2Config = {
    accountId: 'account-id',
    accessKeyId: 'access-key',
    secretAccessKey: 'secret-key',
    bucketName: 'agreements-private',
    endpoint: 'https://account-id.r2.cloudflarestorage.com',
    publicBaseUrl: null,
  };

  let tempDir: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    resetAgreementR2ClientCache();
    resetAgreementUploadStorageForTests();
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'agreement-upload-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    delete process.env.STORAGE_PROVIDER;
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_ENDPOINT;
  });

  it('selects local provider by default', () => {
    expect(readAgreementUploadStorageProvider()).toBe('local');
    const storage = getAgreementUploadStorage();
    expect(storage).toBeInstanceOf(LocalAgreementUploadStorage);
  });

  it('selects hybrid R2 provider when STORAGE_PROVIDER=r2', () => {
    process.env.STORAGE_PROVIDER = 'r2';
    process.env.R2_ACCOUNT_ID = r2Config.accountId;
    process.env.R2_ACCESS_KEY_ID = r2Config.accessKeyId;
    process.env.R2_SECRET_ACCESS_KEY = r2Config.secretAccessKey;
    process.env.R2_BUCKET_NAME = r2Config.bucketName;

    expect(readAgreementR2StorageConfig()).toMatchObject({
      bucketName: 'agreements-private',
    });

    const storage = getAgreementUploadStorage();
    expect(storage).toBeInstanceOf(HybridAgreementUploadStorage);
  });

  it('uploads and downloads files from local storage', async () => {
    const storage = new LocalAgreementUploadStorage(tempDir);

    await storage.upload({
      storageKey,
      bytes,
      mimeType: 'application/pdf',
      originalFilename: 'contract.pdf',
    });

    const downloaded = await storage.download(storageKey);
    expect(downloaded.bytes.equals(bytes)).toBe(true);
    expect(downloaded.storageKey).toBe(storageKey);
  });

  it('deletes local files and reports missing objects', async () => {
    const storage = new LocalAgreementUploadStorage(tempDir);

    await storage.upload({ storageKey, bytes, mimeType: 'application/pdf' });
    await storage.delete(storageKey);

    await expect(storage.download(storageKey)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('uploads, downloads, and deletes objects from R2', async () => {
    mockSend
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        Body: {
          transformToByteArray: async () => Uint8Array.from(bytes),
        },
        ContentType: 'application/pdf',
        Metadata: { originalfilename: 'contract.pdf' },
      })
      .mockResolvedValueOnce({});

    const storage = new R2AgreementUploadStorage(r2Config);

    await storage.upload({
      storageKey,
      bytes,
      mimeType: 'application/pdf',
      originalFilename: 'contract.pdf',
    });

    const downloaded = await storage.download(storageKey);
    expect(downloaded.bytes.equals(bytes)).toBe(true);
    expect(downloaded.mimeType).toBe('application/pdf');
    expect(downloaded.filename).toBe('contract.pdf');

    await storage.delete(storageKey);

    expect(mockSend).toHaveBeenCalledTimes(3);
    const putCommand = mockSend.mock.calls[0][0];
    expect(putCommand.input.Metadata).toEqual({ originalfilename: 'contract.pdf' });
    expect(putCommand.input.CacheControl).toBe('private, no-store');
  });

  it('maps missing R2 objects to not_found errors', async () => {
    mockSend.mockRejectedValueOnce(new NoSuchKey({ message: 'missing', $metadata: {} }));

    const storage = new R2AgreementUploadStorage(r2Config);

    await expect(storage.download(storageKey)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('falls back to local storage when R2 download misses legacy files', async () => {
    const local = new LocalAgreementUploadStorage(tempDir);
    await local.upload({ storageKey, bytes, mimeType: 'application/pdf' });

    const r2 = new R2AgreementUploadStorage(r2Config);
    mockSend.mockRejectedValueOnce(new NoSuchKey({ message: 'missing', $metadata: {} }));

    const hybrid = new HybridAgreementUploadStorage(r2, local);
    const downloaded = await hybrid.download(storageKey);

    expect(downloaded.bytes.equals(bytes)).toBe(true);

    const localPath = path.join(tempDir, storageKey);
    const fileOnDisk = await readFile(localPath);
    expect(fileOnDisk.equals(bytes)).toBe(true);
  });

  it('rejects invalid storage keys', async () => {
    const storage = new LocalAgreementUploadStorage(tempDir);

    await expect(
      storage.upload({
        storageKey: '../secrets.txt',
        bytes,
        mimeType: 'application/pdf',
      })
    ).rejects.toBeInstanceOf(UploadStorageError);
  });
});
