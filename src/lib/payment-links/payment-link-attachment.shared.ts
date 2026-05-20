/**
 * Client-safe payment link attachment constants and validation.
 * Server upload/download lives in payment-link-attachment.ts.
 */

import {
  ASSET_CATEGORY_RULES,
  isLegacySupabaseAttachmentKey,
  isValidStorageObjectKey,
  LEGACY_SUPABASE_ATTACHMENT_BUCKET,
  sanitizeOriginalFilename,
} from '@/lib/storage/asset-validation';

export const PAYMENT_LINK_ATTACHMENT_BUCKET = LEGACY_SUPABASE_ATTACHMENT_BUCKET;

export const PAYMENT_LINK_ATTACHMENT_ALLOWED_MIME = ASSET_CATEGORY_RULES[
  'invoice-attachments'
].allowedMime;

export type PaymentLinkAttachmentMime = (typeof PAYMENT_LINK_ATTACHMENT_ALLOWED_MIME)[number];

export function isAllowedPaymentLinkAttachmentMime(t: string): t is PaymentLinkAttachmentMime {
  return (PAYMENT_LINK_ATTACHMENT_ALLOWED_MIME as readonly string[]).includes(t);
}

export const PAYMENT_LINK_ATTACHMENT_MAX_BYTES =
  ASSET_CATEGORY_RULES['invoice-attachments'].maxBytes;

export { sanitizeOriginalFilename };

export function isValidPaymentLinkAttachmentStorageKey(key: string): boolean {
  if (!key || key.length > 1024) return false;
  if (key.includes('..')) return false;
  return (
    isValidStorageObjectKey(key, 'invoice-attachments') ||
    isLegacySupabaseAttachmentKey(key)
  );
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
