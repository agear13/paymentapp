/**
 * Encryption Utilities
 * 
 * Provides secure encryption/decryption for sensitive data at rest
 * Uses AES-256-GCM (Galois/Counter Mode) for authenticated encryption
 */

import crypto from 'crypto';
import { log } from '@/lib/logger';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64;

/**
 * Get encryption key from environment
 * In production, this should be from a secure key management service (AWS KMS, GCP KMS, etc.)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  
  // Derive a 256-bit key from the environment variable
  return crypto.scryptSync(key, 'provvypay-salt', KEY_LENGTH);
}

/**
 * Encrypt data using AES-256-GCM
 * 
 * @param plaintext - The data to encrypt
 * @returns Encrypted data with IV and auth tag (base64 encoded)
 */
export function encrypt(plaintext: string): string {
  try {
    const key = getEncryptionKey();
    
    // Generate a random initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt the data
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Get the authentication tag
    const authTag = cipher.getAuthTag();
    
    // Combine IV + encrypted data + auth tag
    // Format: iv:encrypted:authTag (all base64)
    const result = `${iv.toString('base64')}:${encrypted}:${authTag.toString('base64')}`;
    
    return result;
  } catch (error: any) {
    log.error({ error: error.message }, 'Encryption failed');
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data encrypted with AES-256-GCM
 * 
 * @param encrypted - The encrypted data (base64 encoded with IV and auth tag)
 * @returns Decrypted plaintext
 */
export function decrypt(encrypted: string): string {
  try {
    const key = getEncryptionKey();
    
    // Split the encrypted data into components
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'base64');
    const encryptedData = parts[1];
    const authTag = Buffer.from(parts[2], 'base64');
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt the data
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error: any) {
    log.error({ error: error.message }, 'Decryption failed');
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash sensitive data (one-way, for comparison only)
 * Uses SHA-256 with salt
 * 
 * @param data - The data to hash
 * @param salt - Optional salt (generated if not provided)
 * @returns Hash and salt (base64 encoded)
 */
export function hash(data: string, salt?: string): { hash: string; salt: string } {
  try {
    const saltBuffer = salt
      ? Buffer.from(salt, 'base64')
      : crypto.randomBytes(SALT_LENGTH);
    
    const hashBuffer = crypto.pbkdf2Sync(
      data,
      saltBuffer,
      100000, // iterations
      64, // key length
      'sha256'
    );
    
    return {
      hash: hashBuffer.toString('base64'),
      salt: saltBuffer.toString('base64'),
    };
  } catch (error: any) {
    log.error({ error: error.message }, 'Hashing failed');
    throw new Error('Failed to hash data');
  }
}

/**
 * Verify hashed data
 * 
 * @param data - The original data to verify
 * @param hash - The hash to compare against
 * @param salt - The salt used for hashing
 * @returns True if data matches hash
 */
export function verifyHash(data: string, hash: string, salt: string): boolean {
  try {
    const computed = crypto.pbkdf2Sync(
      data,
      Buffer.from(salt, 'base64'),
      100000,
      64,
      'sha256'
    );
    
    return computed.toString('base64') === hash;
  } catch (error: any) {
    log.error({ error: error.message }, 'Hash verification failed');
    return false;
  }
}

/**
 * Generate a secure random token
 * 
 * @param length - Length of the token in bytes (default: 32)
 * @returns Base64-encoded random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64');
}

/**
 * Generate a secure random key for encryption
 * Use this for generating new encryption keys
 * 
 * @returns Base64-encoded 256-bit key
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('base64');
}

/**
 * Rotate encryption key
 * Re-encrypts data with a new key
 * 
 * @param encryptedData - Data encrypted with old key
 * @param oldKey - The old encryption key
 * @param newKey - The new encryption key
 * @returns Data re-encrypted with new key
 */
export function rotateKey(encryptedData: string, oldKey: string, newKey: string): string {
  // Temporarily set old key
  const originalKey = process.env.ENCRYPTION_KEY;
  
  try {
    // Decrypt with old key
    process.env.ENCRYPTION_KEY = oldKey;
    const plaintext = decrypt(encryptedData);
    
    // Encrypt with new key
    process.env.ENCRYPTION_KEY = newKey;
    const reencrypted = encrypt(plaintext);
    
    // Restore original key
    process.env.ENCRYPTION_KEY = originalKey;
    
    return reencrypted;
  } catch (error: any) {
    // Restore original key on error
    process.env.ENCRYPTION_KEY = originalKey;
    log.error({ error: error.message }, 'Key rotation failed');
    throw new Error('Failed to rotate encryption key');
  }
}

/**
 * Audit log for encryption operations
 * 
 * @param operation - The operation performed
 * @param success - Whether the operation succeeded
 * @param metadata - Additional metadata
 */
export function logEncryptionOperation(
  operation: 'encrypt' | 'decrypt' | 'rotate' | 'generate',
  success: boolean,
  metadata?: Record<string, any>
) {
  log.info(
    {
      operation,
      success,
      timestamp: new Date().toISOString(),
      ...metadata,
    },
    `Encryption operation: ${operation}`
  );
}

/**
 * Validate encryption key strength
 * 
 * @param key - The key to validate
 * @returns True if key meets security requirements
 */
export function validateKeyStrength(key: string): boolean {
  // Key should be at least 32 characters (256 bits when derived)
  if (key.length < 32) {
    return false;
  }
  
  // Should contain mix of characters
  const hasLower = /[a-z]/.test(key);
  const hasUpper = /[A-Z]/.test(key);
  const hasNumber = /[0-9]/.test(key);
  const hasSpecial = /[^a-zA-Z0-9]/.test(key);
  
  return hasLower && hasUpper && hasNumber && hasSpecial;
}







