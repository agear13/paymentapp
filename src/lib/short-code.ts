/**
 * Short Code Generator for Payment Links
 * Generates URL-safe 8-character unique identifiers
 */

import { prisma } from '@/lib/prisma';

/**
 * Generates a URL-safe short code (8 characters)
 * Uses: A-Z, a-z, 0-9, dash, underscore
 */
const generateRandomShortCode = (): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let code = '';
  
  for (let i = 0; i < 8; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }
  
  return code;
};

/**
 * Generates a unique short code that doesn't exist in the database
 * @param maxAttempts Maximum number of attempts to generate unique code
 * @returns Promise<string> Unique 8-character short code
 * @throws Error if unable to generate unique code after maxAttempts
 */
export const generateUniqueShortCode = async (maxAttempts = 10): Promise<string> => {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const shortCode = generateRandomShortCode();
    
    // Check if code already exists
    const existing = await prisma.payment_links.findUnique({
      where: { short_code: shortCode },
      select: { id: true },
    });
    
    if (!existing) {
      return shortCode;
    }
    
    attempts++;
  }
  
  throw new Error('Failed to generate unique short code after maximum attempts');
};

/**
 * Validates if a short code matches the required format
 * @param code Short code to validate
 * @returns boolean True if valid format
 */
export const isValidShortCode = (code: string): boolean => {
  if (!code || code.length !== 8) {
    return false;
  }
  
  const validPattern = /^[a-zA-Z0-9_-]{8}$/;
  return validPattern.test(code);
};

/**
 * Checks if a short code is available (not already in use)
 * @param code Short code to check
 * @returns Promise<boolean> True if available
 */
export const isShortCodeAvailable = async (code: string): Promise<boolean> => {
  if (!isValidShortCode(code)) {
    return false;
  }
  
  const existing = await prisma.payment_links.findUnique({
    where: { short_code: code },
    select: { id: true },
  });
  
  return !existing;
};




