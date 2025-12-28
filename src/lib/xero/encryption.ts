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
import { log } from '@/lib/logger';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16;

if (!process.env.XERO_ENCRYPTION_KEY) {
  throw new Error('Missing XERO_ENCRYPTION_KEY environment variable');
}

// Derive encryption key from environment variable
function getEncryptionKey(): Buffer {
  const key = process.env.XERO_ENCRYPTION_KEY!;
  // Use SHA-256 to derive a consistent 32-byte key
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt a token string
 * Returns base64-encoded encrypted data with IV and auth tag
 */
export function encryptToken(token: string): string {
  try {
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
    
    // Audit log (without sensitive data)
    log.info(
      'Xero token encrypted',
      {
        operation: 'xero_token_encrypt',
        success: true,
        timestamp: new Date().toISOString(),
      }
    );
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error(
      'Failed to encrypt Xero token',
      error instanceof Error ? error : undefined,
      {
        operation: 'xero_token_encrypt',
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }
    );
    throw new Error('Token encryption failed');
  }
}

/**
 * Decrypt an encrypted token string
 */
export function decryptToken(encryptedToken: string): string {
  try {
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
    
    // Audit log (without sensitive data)
    log.info(
      'Xero token decrypted',
      {
        operation: 'xero_token_decrypt',
        success: true,
        timestamp: new Date().toISOString(),
      }
    );
    
    return decrypted;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error(
      'Failed to decrypt Xero token',
      error instanceof Error ? error : undefined,
      {
        operation: 'xero_token_decrypt',
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }
    );
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

