/**
 * Payment link invoice attachments (merchant-uploaded PNG/JPEG/PDF).
 * Stored in Supabase Storage bucket (private; served only via API).
 */

import { randomUUID } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const PAYMENT_LINK_ATTACHMENT_BUCKET = 'payment-link-attachments';

export const PAYMENT_LINK_ATTACHMENT_ALLOWED_MIME = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/pdf',
] as const;

export type PaymentLinkAttachmentMime = (typeof PAYMENT_LINK_ATTACHMENT_ALLOWED_MIME)[number];

export function isAllowedPaymentLinkAttachmentMime(t: string): t is PaymentLinkAttachmentMime {
  return (PAYMENT_LINK_ATTACHMENT_ALLOWED_MIME as readonly string[]).includes(t);
}

export const PAYMENT_LINK_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024; // 5MB

export function sanitizeOriginalFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\- ]/g, '_').slice(0, 255) || 'attachment';
}

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL ?? requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
}

export function createStorageAdminClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function buildPaymentLinkAttachmentStorageKey(
  organizationId: string,
  mime: string,
  now = Date.now()
): string {
  const ext = extensionForAttachmentMime(mime);
  if (!ext) {
    throw new Error('Invalid file type');
  }
  const safeOrg = organizationId.replace(/[^a-zA-Z0-9-]/g, '');
  const randomId = randomUUID().replace(/-/g, '').slice(0, 12);
  return `payment-links/${safeOrg}/${now}-${randomId}${ext}`;
}

export function isValidPaymentLinkAttachmentStorageKey(key: string): boolean {
  if (!key || key.length > 1024) return false;
  if (!key.startsWith('payment-links/')) return false;
  if (key.includes('..')) return false;
  return true;
}

export interface PaymentLinkAttachmentStoreInput {
  bucket?: string | null;
  storageKey: string;
  bytes: Buffer;
  mimeType: string;
}

export async function uploadPaymentLinkAttachmentToStorage({
  bucket,
  storageKey,
  bytes,
  mimeType,
}: PaymentLinkAttachmentStoreInput): Promise<void> {
  const resolvedBucket = bucket?.trim() || PAYMENT_LINK_ATTACHMENT_BUCKET;
  const supabase = createStorageAdminClient();
  const { error } = await supabase.storage.from(resolvedBucket).upload(storageKey, bytes, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw new Error(`Attachment upload failed: ${error.message}`);
}

export async function downloadPaymentLinkAttachmentFromStorage(
  bucket: string,
  storageKey: string
): Promise<Buffer> {
  const supabase = createStorageAdminClient();
  const { data, error } = await supabase.storage.from(bucket).download(storageKey);
  if (error || !data) throw new Error(error?.message || 'Attachment download failed');
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Best-effort delete of a stored attachment object.
 */
export async function tryDeletePaymentLinkAttachmentFile(
  storageKey: string | null | undefined,
  bucket: string | null | undefined
): Promise<void> {
  if (!storageKey || !isValidPaymentLinkAttachmentStorageKey(storageKey)) return;
  const resolvedBucket = bucket?.trim() || PAYMENT_LINK_ATTACHMENT_BUCKET;
  try {
    const supabase = createStorageAdminClient();
    await supabase.storage.from(resolvedBucket).remove([storageKey]);
  } catch {
    /* ignore */
  }
}

export function extensionForAttachmentMime(mime: string): '.png' | '.jpg' | '.pdf' | null {
  switch (mime) {
    case 'image/png':
      return '.png';
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'application/pdf':
      return '.pdf';
    default:
      return null;
  }
}
