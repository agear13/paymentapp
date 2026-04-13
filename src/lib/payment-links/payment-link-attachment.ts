/**
 * Payment link invoice attachments (merchant-uploaded PNG/JPEG/PDF).
 * Files live under public/uploads/payment-link-attachments/ (same pattern as logo uploads).
 */

import { unlink } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export const PAYMENT_LINK_ATTACHMENT_PUBLIC_PREFIX = '/uploads/payment-link-attachments/';

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

export function isPaymentLinkAttachmentPublicUrl(url: string): boolean {
  if (!url || url.length > 512) return false;
  if (!url.startsWith(PAYMENT_LINK_ATTACHMENT_PUBLIC_PREFIX)) return false;
  if (url.includes('..')) return false;
  return true;
}

const UPLOAD_ROOT = () =>
  path.join(process.cwd(), 'public', 'uploads', 'payment-link-attachments');

/**
 * Absolute filesystem path for a stored attachment, or null if URL is invalid / escapes root.
 */
export function resolvePaymentLinkAttachmentAbsolutePath(publicUrl: string): string | null {
  if (!isPaymentLinkAttachmentPublicUrl(publicUrl)) return null;
  const relative = publicUrl.replace(PAYMENT_LINK_ATTACHMENT_PUBLIC_PREFIX, '').trim();
  if (!relative || relative.includes('..')) return null;
  const root = path.resolve(UPLOAD_ROOT());
  const abs = path.resolve(root, relative);
  if (!abs.startsWith(root + path.sep) && abs !== root) return null;
  return abs;
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

/**
 * Best-effort delete of a previously stored attachment file (only under our upload dir).
 */
export async function tryDeletePaymentLinkAttachmentFile(publicUrl: string | null | undefined): Promise<void> {
  const abs = publicUrl ? resolvePaymentLinkAttachmentAbsolutePath(publicUrl) : null;
  if (!abs) return;
  if (!existsSync(abs)) return;
  try {
    await unlink(abs);
  } catch {
    /* ignore */
  }
}
