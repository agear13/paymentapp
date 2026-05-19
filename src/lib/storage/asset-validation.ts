/**
 * Asset validation — MIME, extension, size, and path isolation.
 */

import { randomUUID } from 'crypto';
import type { AssetCategory } from '@/lib/storage/types';
import { StorageServiceError } from '@/lib/storage/types';

export const BLOCKED_EXTENSIONS = new Set([
  '.svg',
  '.html',
  '.htm',
  '.js',
  '.mjs',
  '.cjs',
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.php',
  '.php3',
  '.php4',
  '.php5',
  '.phtml',
  '.asp',
  '.aspx',
  '.jsp',
  '.jar',
  '.msi',
  '.dll',
  '.com',
  '.scr',
  '.vbs',
  '.ps1',
]);

type CategoryRule = {
  allowedMime: readonly string[];
  allowedExtensions: readonly string[];
  maxBytes: number;
  visibility: 'public' | 'private';
};

export const ASSET_CATEGORY_RULES: Record<AssetCategory, CategoryRule> = {
  'merchant-logos': {
    allowedMime: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp'],
    maxBytes: 2 * 1024 * 1024,
    visibility: 'public',
  },
  'invoice-attachments': {
    allowedMime: ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'],
    allowedExtensions: ['.png', '.jpg', '.jpeg', '.pdf'],
    maxBytes: 5 * 1024 * 1024,
    visibility: 'private',
  },
  'payment-instructions': {
    allowedMime: ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'],
    allowedExtensions: ['.png', '.jpg', '.jpeg', '.pdf'],
    maxBytes: 5 * 1024 * 1024,
    visibility: 'private',
  },
  'qr-assets': {
    allowedMime: ['image/png', 'image/jpeg', 'image/jpg'],
    allowedExtensions: ['.png', '.jpg', '.jpeg'],
    maxBytes: 1 * 1024 * 1024,
    visibility: 'public',
  },
  'invoice-exports': {
    allowedMime: ['application/pdf'],
    allowedExtensions: ['.pdf'],
    maxBytes: 10 * 1024 * 1024,
    visibility: 'private',
  },
};

export function sanitizeOriginalFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\- ]/g, '_').slice(0, 255) || 'attachment';
}

export function sanitizeOrganizationId(organizationId: string): string {
  const safe = organizationId.replace(/[^a-zA-Z0-9-]/g, '');
  if (!safe) {
    throw new StorageServiceError('ownership_violation', 'Invalid organization id');
  }
  return safe;
}

export function sanitizeResourceId(resourceId: string): string {
  const safe = resourceId.replace(/[^a-zA-Z0-9-]/g, '');
  if (!safe) {
    throw new StorageServiceError('ownership_violation', 'Invalid resource id');
  }
  return safe;
}

export function extensionForMime(
  mimeType: string,
  category: AssetCategory
): string | null {
  const normalized = mimeType.toLowerCase();
  const rules = ASSET_CATEGORY_RULES[category];
  if (!rules.allowedMime.includes(normalized)) return null;

  switch (normalized) {
    case 'image/png':
      return '.png';
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'application/pdf':
      return '.pdf';
    default:
      return null;
  }
}

export function validateUploadBytes(input: {
  category: AssetCategory;
  mimeType: string;
  bytes: Buffer;
  originalFilename?: string;
}): { mimeType: string; extension: string } {
  const rules = ASSET_CATEGORY_RULES[input.category];
  const mimeType = input.mimeType.toLowerCase().trim();
  const filenameExt = input.originalFilename
    ? input.originalFilename.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? ''
    : '';

  if (filenameExt && BLOCKED_EXTENSIONS.has(filenameExt)) {
    throw new StorageServiceError(
      'invalid_extension',
      `Blocked file extension: ${filenameExt}`
    );
  }

  const extensionFromMime = extensionForMime(mimeType, input.category);
  if (!extensionFromMime || !rules.allowedMime.includes(mimeType)) {
    throw new StorageServiceError(
      'invalid_mime',
      `Invalid MIME type for ${input.category}: ${mimeType || 'unknown'}`
    );
  }

  if (filenameExt && !rules.allowedExtensions.includes(filenameExt)) {
    throw new StorageServiceError(
      'invalid_extension',
      `File extension does not match allowed types for ${input.category}`
    );
  }

  if (input.bytes.length > rules.maxBytes) {
    throw new StorageServiceError(
      'oversized',
      `File exceeds maximum size of ${rules.maxBytes} bytes for ${input.category}`
    );
  }

  if (input.bytes.length === 0) {
    throw new StorageServiceError('invalid_mime', 'Empty file upload rejected');
  }

  return { mimeType, extension: extensionFromMime };
}

export function buildStorageObjectKey(input: {
  category: AssetCategory;
  organizationId: string;
  extension: string;
  resourceId?: string;
}): string {
  const org = sanitizeOrganizationId(input.organizationId);
  const ext = input.extension.startsWith('.') ? input.extension : `.${input.extension}`;
  const objectId = randomUUID();

  if (input.category === 'merchant-logos') {
    return `merchant-logos/${org}/${objectId}${ext}`;
  }

  if (input.category === 'invoice-attachments') {
    const invoiceId = input.resourceId
      ? sanitizeResourceId(input.resourceId)
      : 'draft';
    return `invoice-attachments/${org}/${invoiceId}/${objectId}${ext}`;
  }

  if (input.category === 'payment-instructions') {
    return `payment-instructions/${org}/${objectId}${ext}`;
  }

  if (input.category === 'qr-assets') {
    return `qr-assets/${org}/${objectId}${ext}`;
  }

  return `invoice-exports/${org}/${objectId}${ext}`;
}

export function isValidStorageObjectKey(key: string, category?: AssetCategory): boolean {
  if (!key || key.length > 1024) return false;
  if (key.includes('..') || key.startsWith('/')) return false;

  if (category) {
    return key.startsWith(`${category}/`);
  }

  return ASSET_CATEGORY_RULES[
    key.split('/')[0] as AssetCategory
  ] !== undefined;
}

export function validateAssetOwnership(input: {
  storageKey: string;
  organizationId: string;
  category: AssetCategory;
}): boolean {
  if (!isValidStorageObjectKey(input.storageKey, input.category)) {
    return false;
  }

  const safeOrg = sanitizeOrganizationId(input.organizationId);
  const parts = input.storageKey.split('/');
  if (parts.length < 2) return false;
  return parts[1] === safeOrg;
}

/** Legacy Supabase attachment keys (pre-R2 migration). */
export function isLegacySupabaseAttachmentKey(storageKey: string): boolean {
  return storageKey.startsWith('payment-links/') && !storageKey.includes('..');
}

export const LEGACY_SUPABASE_ATTACHMENT_BUCKET = 'payment-link-attachments';
