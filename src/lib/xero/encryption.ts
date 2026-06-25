/**
 * Token Encryption Utility
 * Encrypts and decrypts sensitive Xero OAuth tokens
 * 
 * Security Features:
 * - AES-256-GCM authenticated encryption
 * - Random IVs for each encryption
 * - Authentication tags prevent tampering
 * - Audit logging for all operations
 */

import crypto from 'crypto';
import { loggers } from '@/lib/logger';
import { XeroConfigurationError } from './xero-config';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  if (!process.env.XERO_ENCRYPTION_KEY) {
    loggers.xero.error('xero_encryption_key_missing', undefined, {
      step: 'encryption_key_check',
    });
    throw new XeroConfigurationError(['XERO_ENCRYPTION_KEY']);
  }
  const key = process.env.XERO_ENCRYPTION_KEY;
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt a token string
 * Returns base64-encoded encrypted data with IV and auth tag
 */
export function encryptToken(token: string): string {
  try {
    loggers.xero.debug('xero_token_encrypt_start', { step: 'encrypt_token' });
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV + encrypted data + auth tag
    const combined = Buffer.concat([
      iv,
      Buffer.from(encrypted, 'hex'),
      authTag,
    ]);
    
    const result = combined.toString('base64');

    loggers.xero.debug('xero_token_encrypt_success', { step: 'encrypt_token' });

    return result;
  } catch (error) {
    loggers.xero.error('xero_token_encrypt_failed', error, { step: 'encrypt_token' });
    if (error instanceof XeroConfigurationError) {
      throw error;
    }
    throw new Error('Token encryption failed');
  }
}

/**
 * Decrypt an encrypted token string
 */
export function decryptToken(encryptedToken: string): string {
  try {
    loggers.xero.debug('xero_token_decrypt_start', { step: 'decrypt_token' });
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedToken, 'base64');
    
    // Extract IV, encrypted data, and auth tag
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    loggers.xero.debug('xero_token_decrypt_success', { step: 'decrypt_token' });

    return decrypted;
  } catch (error) {
    loggers.xero.error('xero_token_decrypt_failed', error, { step: 'decrypt_token' });
    if (error instanceof XeroConfigurationError) {
      throw error;
    }
    throw new Error('Token decryption failed');
  }
}

/**
 * Generate a secure encryption key (for initial setup)
 * This should be run once and stored in environment variables
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('base64');
}

