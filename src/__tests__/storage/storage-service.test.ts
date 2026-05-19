import { rm } from 'fs/promises';
import path from 'path';

import {
  uploadAsset,
  downloadAsset,
  deleteAsset,
  getPublicAssetUrl,
} from '@/lib/storage/storage-service';

describe('storage-service', () => {
  const originalEnv = process.env;
  const uploadedKeys: Array<{ storageKey: string; bucket: string }> = [];

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      R2_ACCOUNT_ID: '',
      R2_ACCESS_KEY_ID: '',
      R2_SECRET_ACCESS_KEY: '',
      R2_BUCKET_NAME: '',
      R2_PUBLIC_URL: '',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    };
    uploadedKeys.length = 0;
  });

  afterEach(async () => {
    for (const item of uploadedKeys) {
      try {
        await deleteAsset({
          storageKey: item.storageKey,
          bucket: item.bucket,
          organizationId: 'org-test',
          category: 'merchant-logos',
        });
      } catch {
        /* ignore */
      }
      try {
        await rm(path.join(process.cwd(), 'public', 'uploads', item.storageKey), { force: true });
      } catch {
        /* ignore */
      }
    }
    process.env = originalEnv;
  });

  it('uploads and downloads merchant logos via local fallback in test env', async () => {
    const bytes = Buffer.from('fake-png-content');
    const uploaded = await uploadAsset({
      category: 'merchant-logos',
      organizationId: 'org-test',
      bytes,
      mimeType: 'image/png',
      originalFilename: 'logo.png',
    });
    uploadedKeys.push({ storageKey: uploaded.storageKey, bucket: uploaded.bucket });

    expect(uploaded.storageKey).toMatch(/^merchant-logos\/org-test\//);
    expect(uploaded.bucket).toBe('local-uploads');

    const downloaded = await downloadAsset({
      storageKey: uploaded.storageKey,
      bucket: uploaded.bucket,
      organizationId: 'org-test',
      category: 'merchant-logos',
    });
    expect(downloaded.bytes.toString()).toBe('fake-png-content');
  });

  it('rejects blocked SVG uploads', async () => {
    await expect(
      uploadAsset({
        category: 'merchant-logos',
        organizationId: 'org-test',
        bytes: Buffer.from('<svg></svg>'),
        mimeType: 'image/svg+xml',
        originalFilename: 'logo.svg',
      })
    ).rejects.toMatchObject({ code: 'invalid_extension' });
  });

  it('rejects oversized uploads', async () => {
    await expect(
      uploadAsset({
        category: 'merchant-logos',
        organizationId: 'org-test',
        bytes: Buffer.alloc(3 * 1024 * 1024),
        mimeType: 'image/png',
        originalFilename: 'logo.png',
      })
    ).rejects.toMatchObject({ code: 'oversized' });
  });

  it('throws misconfigured error in production without R2', async () => {
    process.env.NODE_ENV = 'production';
    await expect(
      uploadAsset({
        category: 'merchant-logos',
        organizationId: 'org-test',
        bytes: Buffer.from('png'),
        mimeType: 'image/png',
      })
    ).rejects.toMatchObject({ code: 'misconfigured' });
  });
});

describe('getPublicAssetUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      R2_PUBLIC_URL: 'https://assets.example.com',
      R2_ACCOUNT_ID: 'acc',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET_NAME: 'bucket',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('builds public URLs for merchant logo keys when R2 is configured', () => {
    const url = getPublicAssetUrl('merchant-logos/org-1/logo.png', 'merchant-logos');
    expect(url).toBe('https://assets.example.com/merchant-logos/org-1/logo.png');
  });

  it('returns null for private attachment categories', () => {
    const url = getPublicAssetUrl('invoice-attachments/org-1/inv/file.pdf', 'invoice-attachments');
    expect(url).toBeNull();
  });
});
