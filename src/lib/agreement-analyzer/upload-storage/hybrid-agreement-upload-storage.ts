import type {
  AgreementUploadDownloadResult,
  AgreementUploadStorageInput,
  AgreementUploadStorageResult,
  UploadStorageService,
} from '@/lib/agreement-analyzer/upload-storage/types';
import { UploadStorageError } from '@/lib/agreement-analyzer/upload-storage/types';
import { isAgreementStorageKey } from '@/lib/agreement-analyzer/upload-storage/validate-storage-key';

export class HybridAgreementUploadStorage implements UploadStorageService {
  constructor(
    private readonly primary: UploadStorageService,
    private readonly fallback: UploadStorageService
  ) {}

  async upload(input: AgreementUploadStorageInput): Promise<AgreementUploadStorageResult> {
    return this.primary.upload(input);
  }

  async download(storageKey: string): Promise<AgreementUploadDownloadResult> {
    if (!isAgreementStorageKey(storageKey)) {
      return this.primary.download(storageKey);
    }

    try {
      return await this.primary.download(storageKey);
    } catch (error) {
      if (!(error instanceof UploadStorageError) || error.code !== 'not_found') {
        throw error;
      }

      return this.fallback.download(storageKey);
    }
  }

  async delete(storageKey: string): Promise<void> {
    const errors: unknown[] = [];

    await this.primary.delete(storageKey).catch((error) => {
      errors.push(error);
    });

    if (isAgreementStorageKey(storageKey)) {
      await this.fallback.delete(storageKey).catch((error) => {
        errors.push(error);
      });
    }

    if (errors.length === 2) {
      throw new UploadStorageError('delete_failed', 'Failed to delete agreement file from storage', {
        cause: errors[0],
      });
    }
  }
}
