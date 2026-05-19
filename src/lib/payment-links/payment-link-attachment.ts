/**
 * Payment link invoice attachments — delegates to centralized storage-service.
 */

import { randomUUID } from 'crypto';

import {
  ASSET_CATEGORY_RULES,
  buildStorageObjectKey,
  isLegacySupabaseAttachmentKey,
  isValidStorageObjectKey,
  LEGACY_SUPABASE_ATTACHMENT_BUCKET,
  sanitizeOriginalFilename,
} from '@/lib/storage/asset-validation';
import {
  deleteAsset,
  downloadAsset,
  uploadAsset,
  validateAssetOwnershipKey,
} from '@/lib/storage/storage-service';

export const PAYMENT_LINK_ATTACHMENT_BUCKET = LEGACY_SUPABASE_ATTACHMENT_BUCKET;

export const PAYMENT_LINK_ATTACHMENT_ALLOWED_MIME = ASSET_CATEGORY_RULES[
  'invoice-attachments'
].allowedMime;

export type PaymentLinkAttachmentMime = (typeof PAYMENT_LINK_ATTACHMENT_ALLOWED_MIME)[number];

export function isAllowedPaymentLinkAttachmentMime(t: string): t is PaymentLinkAttachmentMime {
  return (PAYMENT_LINK_ATTACHMENT_ALLOWED_MIME as readonly string[]).includes(t);
}

export const PAYMENT_LINK_ATTACHMENT_MAX_BYTES = ASSET_CATEGORY_RULES['invoice-attachments'].maxBytes;

export { sanitizeOriginalFilename };

/** @deprecated Use storage-service buildStorageObjectKey via uploadAsset */
export function buildPaymentLinkAttachmentStorageKey(
  organizationId: string,
  mime: string,
  paymentLinkId?: string,
  now = Date.now()
): string {
  const ext = extensionForAttachmentMime(mime);
  if (!ext) {
    throw new Error('Invalid file type');
  }

  if (paymentLinkId) {
    return buildStorageObjectKey({
      category: 'invoice-attachments',
      organizationId,
      extension: ext,
      resourceId: paymentLinkId,
    });
  }

  const safeOrg = organizationId.replace(/[^a-zA-Z0-9-]/g, '');
  const randomId = randomUUID().replace(/-/g, '').slice(0, 12);
  return `payment-links/${safeOrg}/${now}-${randomId}${ext}`;
}

export function isValidPaymentLinkAttachmentStorageKey(key: string): boolean {
  if (!key || key.length > 1024) return false;
  if (key.includes('..')) return false;
  return (
    isValidStorageObjectKey(key, 'invoice-attachments') ||
    isLegacySupabaseAttachmentKey(key)
  );
}

export interface PaymentLinkAttachmentStoreInput {
  bucket?: string | null;
  storageKey?: string;
  bytes: Buffer;
  mimeType: string;
  organizationId: string;
  paymentLinkId?: string;
  originalFilename?: string;
}

export async function uploadPaymentLinkAttachmentToStorage({
  bytes,
  mimeType,
  organizationId,
  paymentLinkId,
  originalFilename,
}: PaymentLinkAttachmentStoreInput): Promise<{
  storageKey: string;
  bucket: string;
}> {
  const result = await uploadAsset({
    category: 'invoice-attachments',
    organizationId,
    bytes,
    mimeType,
    resourceId: paymentLinkId,
    originalFilename,
    context: 'payment-link-attachment.upload',
  });

  return {
    storageKey: result.storageKey,
    bucket: result.bucket,
  };
}

export async function downloadPaymentLinkAttachmentFromStorage(
  bucket: string,
  storageKey: string,
  organizationId?: string
): Promise<Buffer> {
  const downloaded = await downloadAsset({
    bucket,
    storageKey,
    organizationId,
    category: 'invoice-attachments',
    context: 'payment-link-attachment.download',
  });
  return downloaded.bytes;
}

export async function tryDeletePaymentLinkAttachmentFile(
  storageKey: string | null | undefined,
  bucket: string | null | undefined,
  organizationId?: string
): Promise<void> {
  if (!storageKey || !isValidPaymentLinkAttachmentStorageKey(storageKey)) return;

  if (organizationId && storageKey.startsWith('invoice-attachments/')) {
    if (
      !validateAssetOwnershipKey({
        storageKey,
        organizationId,
        category: 'invoice-attachments',
      })
    ) {
      return;
    }
  }

  const resolvedBucket = bucket?.trim() || PAYMENT_LINK_ATTACHMENT_BUCKET;
  try {
    await deleteAsset({
      storageKey,
      bucket: resolvedBucket,
      organizationId: organizationId ?? 'unknown',
      category: 'invoice-attachments',
      context: 'payment-link-attachment.delete',
    });
  } catch {
    /* best-effort */
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

