/**
 * Agreement Analyzer upload validation — shared constants and server-side file checks.
 */

import { sanitizeOriginalFilename } from '@/lib/storage/asset-validation';

export const AGREEMENT_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

export const AGREEMENT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/jpg',
] as const;

export type AgreementAllowedMime = (typeof AGREEMENT_ALLOWED_MIME_TYPES)[number];

export const AGREEMENT_ALLOWED_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.txt',
  '.png',
  '.jpg',
  '.jpeg',
] as const;

export type AgreementAllowedExtension = (typeof AGREEMENT_ALLOWED_EXTENSIONS)[number];

const MIME_TO_EXTENSIONS: Record<AgreementAllowedMime, readonly AgreementAllowedExtension[]> = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/jpg': ['.jpg', '.jpeg'],
};

export const AGREEMENT_BUSINESS_TYPES = [
  'Hospitality',
  'Professional Services',
  'Technology',
  'Real Estate',
  'Retail',
  'Manufacturing',
  'Other',
] as const;

export type AgreementBusinessType = (typeof AGREEMENT_BUSINESS_TYPES)[number];

export type AgreementFileValidationResult =
  | {
      ok: true;
      mimeType: AgreementAllowedMime;
      extension: AgreementAllowedExtension;
      sanitizedFilename: string;
    }
  | { ok: false; message: string };

export function normalizeAgreementEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function extensionFromFilename(filename: string): string | null {
  const match = filename.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match ? match[1] : null;
}

function detectMimeFromBytes(bytes: Buffer): AgreementAllowedMime | null {
  if (bytes.length >= 4 && bytes.subarray(0, 4).toString('ascii') === '%PDF') {
    return 'application/pdf';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (bytes.length > 0) {
    const sample = bytes.subarray(0, Math.min(bytes.length, 8192));
    if (!sample.includes(0)) {
      return 'text/plain';
    }
  }
  return null;
}

function mimeMatchesClient(declared: string, detected: AgreementAllowedMime): boolean {
  const normalized = declared.trim().toLowerCase();
  if (normalized === detected) return true;
  if (
    (normalized === 'image/jpg' || normalized === 'image/jpeg') &&
    (detected === 'image/jpeg' || detected === 'image/jpg')
  ) {
    return true;
  }
  return false;
}

export function validateAgreementFile(
  bytes: Buffer,
  originalFilename: string,
  declaredMimeType: string
): AgreementFileValidationResult {
  if (!bytes.length) {
    return { ok: false, message: 'The uploaded file is empty.' };
  }
  if (bytes.length > AGREEMENT_UPLOAD_MAX_BYTES) {
    return { ok: false, message: 'File is too large. Maximum size is 25MB.' };
  }

  const sanitizedFilename = sanitizeOriginalFilename(originalFilename);
  const filenameExt = extensionFromFilename(sanitizedFilename);
  if (!filenameExt || !(AGREEMENT_ALLOWED_EXTENSIONS as readonly string[]).includes(filenameExt)) {
    return {
      ok: false,
      message: 'Unsupported file extension. Allowed: PDF, DOCX, TXT, PNG, JPG, JPEG.',
    };
  }

  const detectedMime = detectMimeFromBytes(bytes);
  if (!detectedMime) {
    return {
      ok: false,
      message: 'Could not verify file type. Allowed: PDF, DOCX, TXT, PNG, JPG, JPEG.',
    };
  }

  if (!mimeMatchesClient(declaredMimeType, detectedMime)) {
    return {
      ok: false,
      message: 'File content does not match the declared file type.',
    };
  }

  const allowedExts = MIME_TO_EXTENSIONS[detectedMime];
  if (!(allowedExts as readonly string[]).includes(filenameExt)) {
    return {
      ok: false,
      message: 'File extension does not match file content.',
    };
  }

  return {
    ok: true,
    mimeType: detectedMime,
    extension: filenameExt as AgreementAllowedExtension,
    sanitizedFilename,
  };
}

export function extensionForAgreementMime(mime: AgreementAllowedMime): AgreementAllowedExtension {
  const extensions = MIME_TO_EXTENSIONS[mime];
  return extensions[0];
}
