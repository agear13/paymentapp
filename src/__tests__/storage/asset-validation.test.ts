import {
  buildStorageObjectKey,
  validateAssetOwnership,
  validateUploadBytes,
} from '@/lib/storage/asset-validation';
import { StorageServiceError } from '@/lib/storage/types';

describe('asset-validation', () => {
  it('builds organization-scoped merchant logo keys', () => {
    const key = buildStorageObjectKey({
      category: 'merchant-logos',
      organizationId: 'org-123',
      extension: '.png',
    });
    expect(key).toMatch(/^merchant-logos\/org-123\/[0-9a-f-]+\.png$/);
  });

  it('rejects blocked extensions', () => {
    expect(() =>
      validateUploadBytes({
        category: 'merchant-logos',
        mimeType: 'image/svg+xml',
        bytes: Buffer.from('test'),
        originalFilename: 'logo.svg',
      })
    ).toThrow(StorageServiceError);
  });

  it('rejects oversized logo uploads', () => {
    expect(() =>
      validateUploadBytes({
        category: 'merchant-logos',
        mimeType: 'image/png',
        bytes: Buffer.alloc(3 * 1024 * 1024),
        originalFilename: 'logo.png',
      })
    ).toThrow(StorageServiceError);
  });

  it('validates organization ownership for storage keys', () => {
    const key = buildStorageObjectKey({
      category: 'invoice-attachments',
      organizationId: 'org-abc',
      extension: '.pdf',
      resourceId: 'invoice-1',
    });

    expect(
      validateAssetOwnership({
        storageKey: key,
        organizationId: 'org-abc',
        category: 'invoice-attachments',
      })
    ).toBe(true);

    expect(
      validateAssetOwnership({
        storageKey: key,
        organizationId: 'org-other',
        category: 'invoice-attachments',
      })
    ).toBe(false);
  });
});
