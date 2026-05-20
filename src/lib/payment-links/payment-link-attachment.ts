/**
 * Payment link invoice attachments — server-side storage operations.
 */

import 'server-only';

import { randomUUID } from 'crypto';

import { buildStorageObjectKey } from '@/lib/storage/asset-validation';
import {
  deleteAsset,
  downloadAsset,
  uploadAsset,
  validateAssetOwnershipKey,
} from '@/lib/storage/storage-service';

export {
  extensionForAttachmentMime,
  isAllowedPaymentLinkAttachmentMime,
  isValidPaymentLinkAttachmentStorageKey,
  PAYMENT_LINK_ATTACHMENT_ALLOWED_MIME,
  PAYMENT_LINK_ATTACHMENT_BUCKET,
  PAYMENT_LINK_ATTACHMENT_MAX_BYTES,
  sanitizeOriginalFilename,
  type PaymentLinkAttachmentMime,
} from '@/lib/payment-links/payment-link-attachment.shared';

import {
  extensionForAttachmentMime,
  isValidPaymentLinkAttachmentStorageKey,
  PAYMENT_LINK_ATTACHMENT_BUCKET,
} from '@/lib/payment-links/payment-link-attachment.shared';

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
