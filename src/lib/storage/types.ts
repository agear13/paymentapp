/**
 * Operational asset storage types — single source of truth for upload categories.
 */

export const ASSET_CATEGORIES = [
  'merchant-logos',
  'invoice-attachments',
  'payment-instructions',
  'qr-assets',
  'invoice-exports',
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export type AssetVisibility = 'public' | 'private';

export type StorageProviderName = 'r2' | 'local' | 'legacy-supabase';

export type UploadAssetInput = {
  category: AssetCategory;
  organizationId: string;
  bytes: Buffer;
  mimeType: string;
  originalFilename?: string;
  /** Required for invoice-attachments when invoice id is known */
  resourceId?: string;
  visibility?: AssetVisibility;
  context?: string;
};

export type UploadAssetResult = {
  storageKey: string;
  bucket: string;
  publicUrl: string | null;
  mimeType: string;
  sizeBytes: number;
  provider: StorageProviderName;
};

export type DeleteAssetInput = {
  storageKey: string;
  bucket: string;
  organizationId: string;
  category: AssetCategory;
  context?: string;
};

export type DownloadAssetInput = {
  storageKey: string;
  bucket: string;
  organizationId?: string;
  category?: AssetCategory;
  context?: string;
};

export type DownloadAssetResult = {
  bytes: Buffer;
  mimeType: string | null;
  provider: StorageProviderName;
};

export type ValidateAssetOwnershipInput = {
  storageKey: string;
  organizationId: string;
  category: AssetCategory;
};

export type ResolveAssetUrlInput = {
  source: string | null | undefined;
  category?: AssetCategory;
  visibility?: AssetVisibility;
  requestOrigin?: string;
  runtimeOrigin?: string;
  infrastructureOverride?: boolean;
  /** For private invoice attachments served via API proxy */
  proxyPath?: string;
};

export type ResolveAssetUrlResult = {
  url: string | null;
  resolvedFrom: 'absolute' | 'cdn' | 'public_base' | 'proxy' | 'legacy_relative' | 'none';
  source: string | null;
};

export type StorageHealthStatus = {
  configured: boolean;
  provider: StorageProviderName | 'none';
  publicBaseUrl: string | null;
  warnings: string[];
};

export class StorageServiceError extends Error {
  readonly code:
    | 'misconfigured'
    | 'invalid_mime'
    | 'invalid_extension'
    | 'oversized'
    | 'upload_failed'
    | 'delete_failed'
    | 'download_failed'
    | 'ownership_violation'
    | 'unavailable';

  constructor(
    code: StorageServiceError['code'],
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'StorageServiceError';
    this.code = code;
  }
}
