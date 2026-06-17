import 'server-only';

import {
  readAgreementR2StorageConfig,
  readAgreementUploadStorageProvider,
} from '@/lib/agreement-analyzer/upload-storage/agreement-upload-storage-config';
import { logAgreementStorageStartup } from '@/lib/agreement-analyzer/upload-storage/agreement-upload-storage-diagnostics.server';
import { HybridAgreementUploadStorage } from '@/lib/agreement-analyzer/upload-storage/hybrid-agreement-upload-storage';
import { LocalAgreementUploadStorage } from '@/lib/agreement-analyzer/upload-storage/local-upload-storage';
import { R2AgreementUploadStorage } from '@/lib/agreement-analyzer/upload-storage/r2-agreement-upload-storage';
import type { UploadStorageService } from '@/lib/agreement-analyzer/upload-storage/types';
import { UploadStorageError } from '@/lib/agreement-analyzer/upload-storage/types';
import { R2_PRODUCTION_ENV_MESSAGE } from '@/lib/storage/storage-config';

let cachedService: UploadStorageService | null = null;

function createUploadStorageService(): UploadStorageService {
  logAgreementStorageStartup();

  const provider = readAgreementUploadStorageProvider();

  if (provider === 'r2') {
    const r2Config = readAgreementR2StorageConfig();
    if (!r2Config) {
      throw new UploadStorageError(
        'misconfigured',
        `Object storage is not configured. ${R2_PRODUCTION_ENV_MESSAGE}`
      );
    }

    const r2Storage = new R2AgreementUploadStorage(r2Config);
    const localStorage = new LocalAgreementUploadStorage();
    return new HybridAgreementUploadStorage(r2Storage, localStorage);
  }

  return new LocalAgreementUploadStorage();
}

/**
 * Returns the active agreement upload storage provider.
 */
export function getAgreementUploadStorage(): UploadStorageService {
  if (!cachedService) {
    cachedService = createUploadStorageService();
  }
  return cachedService;
}

/** Test helper — reset cached provider selection. */
export function resetAgreementUploadStorageForTests(): void {
  cachedService = null;
}
