/**
 * Centralized operational asset storage — single entry point for uploads/assets.
 */

import 'server-only';

import {
  ASSET_CATEGORY_RULES,
  buildStorageObjectKey,
  LEGACY_SUPABASE_ATTACHMENT_BUCKET,
  validateAssetOwnership as validateOwnership,
  validateUploadBytes,
} from '@/lib/storage/asset-validation';
import {
  isLegacySupabaseAttachment,
  legacySupabaseDeleteObject,
  legacySupabaseDownloadObject,
} from '@/lib/storage/providers/legacy-supabase-storage';
import {
  localDeleteObject,
  localDownloadObject,
  localPublicUrlForKey,
  localUploadObject,
} from '@/lib/storage/providers/local-storage';
import {
  r2DeleteObject,
  r2DownloadObject,
  r2PublicUrlForKey,
  r2UploadObject,
} from '@/lib/storage/providers/r2-storage';
import { resolveAssetUrl, resolvePublicAssetUrlForKey } from '@/lib/storage/resolve-asset-url';
import {
  evaluateStorageHealth,
  isR2Configured,
  logStorageStartupHealth,
  readStorageConfig,
} from '@/lib/storage/storage-config';
import type {
  DeleteAssetInput,
  DownloadAssetInput,
  DownloadAssetResult,
  StorageHealthStatus,
  StorageProviderName,
  UploadAssetInput,
  UploadAssetResult,
  ValidateAssetOwnershipInput,
} from '@/lib/storage/types';
import { StorageServiceError } from '@/lib/storage/types';

export {
  resolveAssetUrl,
  resolvePublicAssetUrlForKey,
} from '@/lib/storage/resolve-asset-url';
export type {
  AssetCategory,
  ResolveAssetUrlInput,
  ResolveAssetUrlResult,
  StorageHealthStatus,
  UploadAssetInput,
  UploadAssetResult,
} from '@/lib/storage/types';
export {
  ASSET_CATEGORY_RULES,
  buildStorageObjectKey,
  isLegacySupabaseAttachmentKey,
  isValidStorageObjectKey,
  LEGACY_SUPABASE_ATTACHMENT_BUCKET,
  sanitizeOriginalFilename,
  validateAssetOwnership as validateAssetOwnershipKey,
} from '@/lib/storage/asset-validation';
export { ASSET_CATEGORIES } from '@/lib/storage/types';

function logStorageEvent(event: string, payload: Record<string, unknown>): void {
  console.info('[StorageService]', { event, ...payload });
}

function logStorageFailure(event: string, payload: Record<string, unknown>): void {
  console.warn('[StorageService]', { event, ...payload });
}

function activeProvider(): StorageProviderName {
  logStorageStartupHealth();
  const config = readStorageConfig();
  if (isR2Configured(config)) return 'r2';
  if (process.env.NODE_ENV === 'production') {
    throw new StorageServiceError(
      'misconfigured',
      'Object storage is not configured for production uploads. Configure Cloudflare R2 environment variables.'
    );
  }
  return 'local';
}

function bucketForProvider(provider: StorageProviderName): string {
  const config = readStorageConfig();
  if (provider === 'r2') return config.r2.bucketName!;
  if (provider === 'local') return 'local-uploads';
  return LEGACY_SUPABASE_ATTACHMENT_BUCKET;
}

/**
 * Upload an operational asset to persistent object storage.
 */
export async function uploadAsset(input: UploadAssetInput): Promise<UploadAssetResult> {
  const context = input.context ?? 'uploadAsset';
  const provider = activeProvider();
  const config = readStorageConfig();
  const rules = ASSET_CATEGORY_RULES[input.category];
  const visibility = input.visibility ?? rules.visibility;

  logStorageEvent('upload_started', {
    context,
    category: input.category,
    organizationId: input.organizationId,
    provider,
    sizeBytes: input.bytes.length,
    mimeType: input.mimeType,
  });

  let validated;
  try {
    validated = validateUploadBytes({
      category: input.category,
      mimeType: input.mimeType,
      bytes: input.bytes,
      originalFilename: input.originalFilename,
    });
  } catch (error) {
    if (error instanceof StorageServiceError) {
      logStorageFailure('upload_rejected', {
        context,
        category: input.category,
        reason: error.code,
        message: error.message,
      });
    }
    throw error;
  }

  const storageKey = buildStorageObjectKey({
    category: input.category,
    organizationId: input.organizationId,
    extension: validated.extension,
    resourceId: input.resourceId,
  });

  try {
    if (provider === 'r2') {
      await r2UploadObject(config, {
        storageKey,
        bytes: input.bytes,
        mimeType: validated.mimeType,
        visibility,
      });
    } else {
      await localUploadObject(config, { storageKey, bytes: input.bytes });
    }
  } catch (error) {
    const message =
      error instanceof StorageServiceError
        ? error.message
        : 'Asset upload failed. Please try again.';
    logStorageFailure('upload_failed', {
      context,
      category: input.category,
      storageKey,
      provider,
      message,
    });
    throw error instanceof StorageServiceError
      ? error
      : new StorageServiceError('upload_failed', message, { cause: error });
  }

  const bucket = bucketForProvider(provider);
  const publicUrl =
    visibility === 'public'
      ? getPublicAssetUrl(storageKey, input.category)
      : null;

  logStorageEvent('upload_completed', {
    context,
    category: input.category,
    storageKey,
    bucket,
    provider,
    publicUrl,
  });

  return {
    storageKey,
    bucket,
    publicUrl,
    mimeType: validated.mimeType,
    sizeBytes: input.bytes.length,
    provider,
  };
}

/**
 * Delete an asset from storage (best-effort for legacy objects).
 */
export async function deleteAsset(input: DeleteAssetInput): Promise<void> {
  const context = input.context ?? 'deleteAsset';
  const config = readStorageConfig();

  if (!validateOwnership(input)) {
    if (!isLegacySupabaseAttachment(input.bucket, input.storageKey)) {
      throw new StorageServiceError(
        'ownership_violation',
        'Asset does not belong to the specified organization'
      );
    }
  }

  try {
    if (isLegacySupabaseAttachment(input.bucket, input.storageKey)) {
      await legacySupabaseDeleteObject(input.bucket, input.storageKey);
      logStorageEvent('delete_completed', {
        context,
        storageKey: input.storageKey,
        bucket: input.bucket,
        provider: 'legacy-supabase',
      });
      return;
    }

    if (isR2Configured(config) && input.bucket === config.r2.bucketName) {
      await r2DeleteObject(config, input.storageKey);
      logStorageEvent('delete_completed', {
        context,
        storageKey: input.storageKey,
        bucket: input.bucket,
        provider: 'r2',
      });
      return;
    }

    if (input.bucket === 'local-uploads') {
      await localDeleteObject(config, input.storageKey);
      logStorageEvent('delete_completed', {
        context,
        storageKey: input.storageKey,
        bucket: input.bucket,
        provider: 'local',
      });
      return;
    }

    throw new StorageServiceError('delete_failed', 'Unknown storage bucket for delete');
  } catch (error) {
    logStorageFailure('delete_failed', {
      context,
      storageKey: input.storageKey,
      bucket: input.bucket,
      message: error instanceof Error ? error.message : 'Delete failed',
    });
    throw error instanceof StorageServiceError
      ? error
      : new StorageServiceError('delete_failed', 'Asset delete failed', { cause: error });
  }
}

/**
 * Download asset bytes — server-side only (private attachments, email embeds).
 */
export async function downloadAsset(input: DownloadAssetInput): Promise<DownloadAssetResult> {
  const context = input.context ?? 'downloadAsset';
  const config = readStorageConfig();

  if (
    input.organizationId &&
    input.category &&
    !validateOwnership({
      storageKey: input.storageKey,
      organizationId: input.organizationId,
      category: input.category,
    }) &&
    !isLegacySupabaseAttachment(input.bucket, input.storageKey)
  ) {
    throw new StorageServiceError(
      'ownership_violation',
      'Asset does not belong to the specified organization'
    );
  }

  try {
    if (isLegacySupabaseAttachment(input.bucket, input.storageKey)) {
      const bytes = await legacySupabaseDownloadObject(input.bucket, input.storageKey);
      logStorageEvent('download_completed', {
        context,
        storageKey: input.storageKey,
        provider: 'legacy-supabase',
      });
      return { bytes, mimeType: null, provider: 'legacy-supabase' };
    }

    if (isR2Configured(config) && input.bucket === config.r2.bucketName) {
      const bytes = await r2DownloadObject(config, input.storageKey);
      logStorageEvent('download_completed', {
        context,
        storageKey: input.storageKey,
        provider: 'r2',
      });
      return { bytes, mimeType: null, provider: 'r2' };
    }

    if (input.bucket === 'local-uploads') {
      const bytes = await localDownloadObject(config, input.storageKey);
      logStorageEvent('download_completed', {
        context,
        storageKey: input.storageKey,
        provider: 'local',
      });
      return { bytes, mimeType: null, provider: 'local' };
    }

    throw new StorageServiceError('download_failed', 'Unknown storage bucket for download');
  } catch (error) {
    logStorageFailure('download_failed', {
      context,
      storageKey: input.storageKey,
      bucket: input.bucket,
      message: error instanceof Error ? error.message : 'Download failed',
    });
    throw error instanceof StorageServiceError
      ? error
      : new StorageServiceError('download_failed', 'Asset download failed', { cause: error });
  }
}

/**
 * Public URL for a storage object key (public assets only).
 */
export function getPublicAssetUrl(
  storageKey: string,
  category: UploadAssetInput['category'],
  options?: {
    requestOrigin?: string;
  }
): string | null {
  const config = readStorageConfig();
  if (ASSET_CATEGORY_RULES[category].visibility !== 'public') {
    return null;
  }

  if (isR2Configured(config)) {
    return r2PublicUrlForKey(config, storageKey);
  }

  return localPublicUrlForKey(config, storageKey, options?.requestOrigin);
}

/**
 * Validate organization-scoped ownership for a storage key.
 */
export function validateAssetOwnership(input: ValidateAssetOwnershipInput): boolean {
  return validateOwnership(input);
}

/**
 * Storage provider health for operational diagnostics.
 */
export function getStorageHealth(): StorageHealthStatus {
  return evaluateStorageHealth();
}
