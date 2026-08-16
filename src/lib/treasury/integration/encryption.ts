/**
 * AES-256-GCM encryption for treasury provider credentials (e.g. Digital Surge API keys).
 * API keys must never appear in logs.
 */

import crypto from 'crypto';
import { loggers } from '@/lib/logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const raw =
    process.env.TREASURY_ENCRYPTION_KEY?.trim() ||
    process.env.XERO_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error('TREASURY_ENCRYPTION_KEY (or XERO_ENCRYPTION_KEY) is not configured');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptTreasurySecret(secret: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, Buffer.from(encrypted, 'hex'), authTag]);
  return combined.toString('base64');
}

export function decryptTreasurySecret(encryptedSecret: string): string {
  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedSecret, 'base64');
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    loggers.jobs.error('treasury_secret_decrypt_failed', error instanceof Error ? error : undefined);
    throw new Error('Treasury credential decryption failed');
  }
}

/** Redact API key material for safe logging. */
export function redactApiKeyMaterial(value: string | null | undefined): string {
  if (!value?.trim()) return '[empty]';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
