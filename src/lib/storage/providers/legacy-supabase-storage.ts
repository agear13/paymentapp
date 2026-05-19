/**
 * Legacy Supabase attachment adapter — read/delete only for pre-R2 objects.
 */

import { createClient } from '@supabase/supabase-js';

import {
  LEGACY_SUPABASE_ATTACHMENT_BUCKET,
  isLegacySupabaseAttachmentKey,
} from '@/lib/storage/asset-validation';
import { StorageServiceError } from '@/lib/storage/types';

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new StorageServiceError('misconfigured', `Missing required environment variable: ${key}`);
  }
  return value;
}

function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL ?? requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
}

function createLegacySupabaseClient() {
  return createClient(getSupabaseUrl(), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function isLegacySupabaseAttachment(
  bucket: string | null | undefined,
  storageKey: string
): boolean {
  const resolvedBucket = bucket?.trim() || LEGACY_SUPABASE_ATTACHMENT_BUCKET;
  return (
    resolvedBucket === LEGACY_SUPABASE_ATTACHMENT_BUCKET &&
    isLegacySupabaseAttachmentKey(storageKey)
  );
}

export async function legacySupabaseDownloadObject(
  bucket: string,
  storageKey: string
): Promise<Buffer> {
  const supabase = createLegacySupabaseClient();
  const { data, error } = await supabase.storage.from(bucket).download(storageKey);
  if (error || !data) {
    throw new StorageServiceError('download_failed', error?.message || 'Legacy attachment download failed');
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function legacySupabaseDeleteObject(
  bucket: string,
  storageKey: string
): Promise<void> {
  const supabase = createLegacySupabaseClient();
  const { error } = await supabase.storage.from(bucket).remove([storageKey]);
  if (error) {
    throw new StorageServiceError('delete_failed', error.message);
  }
}
