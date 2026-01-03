/**
 * SERVER-ONLY Short Code Database Operations
 * 
 * CRITICAL: This module must NEVER be imported by client-side code.
 * Only import from API routes, Server Components, Server Actions, or scripts.
 */

import 'server-only';
import { prisma } from './prisma';

// Runtime guard: Throw if accidentally imported in browser
if (typeof window !== 'undefined') {
  throw new Error('❌ FATAL: Server-only short-code module imported in the browser!');
}

/**
 * Generates a URL-safe short code (8 characters)
 * Uses: A-Z, a-z, 0-9, dash, underscore
 */
const generateRandomShortCode = (): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const SHORT_CODE_LENGTH = 8;
  let code = '';
  
  for (let i = 0; i < SHORT_CODE_LENGTH; i++) {
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
 * Checks if a short code is available (not already in use)
 * @param code Short code to check
 * @returns Promise<boolean> True if available
 */
export const isShortCodeAvailable = async (code: string): Promise<boolean> => {
  const { isValidShortCode } = await import('@/lib/short-code');
  
  if (!isValidShortCode(code)) {
    return false;
  }
  
  const existing = await prisma.payment_links.findUnique({
    where: { short_code: code },
    select: { id: true },
  });
  
  return !existing;
};

