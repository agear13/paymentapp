/**
 * Local filesystem storage provider — development fallback only.
 */

import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';

import type { StorageConfig } from '@/lib/storage/storage-config';
import { StorageServiceError } from '@/lib/storage/types';

export type LocalUploadInput = {
  storageKey: string;
  bytes: Buffer;
};

function localPathForKey(config: StorageConfig, storageKey: string): string {
  const safeKey = storageKey.replace(/\\/g, '/').replace(/^\/+/, '');
  if (safeKey.includes('..')) {
    throw new StorageServiceError('ownership_violation', 'Invalid storage key path');
  }
  return path.join(process.cwd(), config.localUploadDir, safeKey);
}

export async function localUploadObject(
  config: StorageConfig,
  input: LocalUploadInput
): Promise<void> {
  const filepath = localPathForKey(config, input.storageKey);
  await mkdir(path.dirname(filepath), { recursive: true });
  try {
    await writeFile(filepath, input.bytes);
  } catch (error) {
    throw new StorageServiceError('upload_failed', 'Local upload failed', { cause: error });
  }
}

export async function localDownloadObject(
  config: StorageConfig,
  storageKey: string
): Promise<Buffer> {
  const filepath = localPathForKey(config, storageKey);
  try {
    return await readFile(filepath);
  } catch (error) {
    throw new StorageServiceError('download_failed', 'Local download failed', { cause: error });
  }
}

export async function localDeleteObject(
  config: StorageConfig,
  storageKey: string
): Promise<void> {
  const filepath = localPathForKey(config, storageKey);
  try {
    await unlink(filepath);
  } catch (error) {
    throw new StorageServiceError('delete_failed', 'Local delete failed', { cause: error });
  }
}

export function localPublicUrlForKey(
  config: StorageConfig,
  storageKey: string,
  requestOrigin?: string
): string | null {
  const base = config.assetCdnUrl ?? requestOrigin ?? process.env.NEXT_PUBLIC_APP_URL ?? null;
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}/${config.localUploadDir}/${storageKey.replace(/^\/+/, '')}`;
}
