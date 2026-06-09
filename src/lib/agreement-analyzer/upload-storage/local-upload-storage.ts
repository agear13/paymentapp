/**
 * Local filesystem upload storage — development only.
 */

import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';

import { emitAgreementUploadStored } from '@/lib/agreement-analyzer/upload-storage/emit-upload-stored.server';
import type {
  AgreementUploadStorageInput,
  AgreementUploadStorageResult,
  UploadStorageService,
} from '@/lib/agreement-analyzer/upload-storage/types';
import { UploadStorageError } from '@/lib/agreement-analyzer/upload-storage/types';
import { assertValidAgreementStorageKey } from '@/lib/agreement-analyzer/upload-storage/validate-storage-key';

const DEFAULT_BASE_DIR = path.join(process.cwd(), 'storage', 'agreement-uploads');

function resolveFilePath(baseDir: string, storageKey: string): string {
  const safeKey = assertValidAgreementStorageKey(storageKey);
  return path.join(baseDir, safeKey);
}

export class LocalAgreementUploadStorage implements UploadStorageService {
  constructor(private readonly baseDir: string = DEFAULT_BASE_DIR) {}

  async upload(input: AgreementUploadStorageInput): Promise<AgreementUploadStorageResult> {
    const filepath = resolveFilePath(this.baseDir, input.storageKey);
    await mkdir(path.dirname(filepath), { recursive: true });
    try {
      await writeFile(filepath, input.bytes);
      emitAgreementUploadStored({
        provider: 'local',
        fileSize: input.bytes.length,
        mimeType: input.mimeType,
      });
      return { storageKey: input.storageKey };
    } catch (error) {
      throw new UploadStorageError('upload_failed', 'Failed to store agreement file locally', {
        cause: error,
      });
    }
  }

  async download(storageKey: string): Promise<{ storageKey: string; bytes: Buffer }> {
    const filepath = resolveFilePath(this.baseDir, storageKey);
    try {
      const bytes = await readFile(filepath);
      return { storageKey, bytes };
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        throw new UploadStorageError('not_found', 'Agreement file not found locally', { cause: error });
      }
      throw new UploadStorageError('upload_failed', 'Failed to read local agreement file', {
        cause: error,
      });
    }
  }

  async delete(storageKey: string): Promise<void> {
    const filepath = resolveFilePath(this.baseDir, storageKey);
    try {
      await unlink(filepath);
    } catch (error) {
      throw new UploadStorageError('delete_failed', 'Failed to delete local agreement file', {
        cause: error,
      });
    }
  }
}
