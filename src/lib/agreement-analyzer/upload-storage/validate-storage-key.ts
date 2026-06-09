import { UploadStorageError } from '@/lib/agreement-analyzer/upload-storage/types';

export function assertValidAgreementStorageKey(storageKey: string): string {
  const safeKey = storageKey.replace(/\\/g, '/').replace(/^\/+/, '');
  if (safeKey.includes('..') || !safeKey.startsWith('agreements/')) {
    throw new UploadStorageError('invalid_key', 'Invalid agreement storage key');
  }
  return safeKey;
}

export function isAgreementStorageKey(storageKey: string): boolean {
  try {
    assertValidAgreementStorageKey(storageKey);
    return true;
  } catch {
    return false;
  }
}
