/**
 * CSRF Protection
 * 
 * Protects against Cross-Site Request Forgery attacks
 * Uses double-submit cookie pattern with signed tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { log } from '@/lib/logger';

const CSRF_SECRET = process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production';
const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate a CSRF token
 */
export function generateCSRFToken(): string {
  const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('base64');
  return token;
}

/**
 * Sign a CSRF token with HMAC
 */
function signToken(token: string): string {
  const hmac = crypto.createHmac('sha256', CSRF_SECRET);
  hmac.update(token);
  return hmac.digest('base64');
}

/**
 * Verify a CSRF token signature
 */
function verifyToken(token: string, signature: string): boolean {
  const expected = signToken(token);
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'base64'),
    Buffer.from(signature, 'base64')
  );
}

/**
 * Extract CSRF token from cookie
 */
function getTokenFromCookie(request: NextRequest): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map(c => c.trim());
  const csrfCookie = cookies.find(c => c.startsWith(`${CSRF_COOKIE_NAME}=`));
  
  if (!csrfCookie) return null;

  const [, value] = csrfCookie.split('=');
  return value;
}

/**
 * Extract CSRF token from header
 */
function getTokenFromHeader(request: NextRequest): string | null {
  return request.headers.get(CSRF_HEADER_NAME);
}

/**
 * Validate CSRF token from request
 * 
 * @param request - The incoming request
 * @returns True if CSRF token is valid
 */
export function validateCSRFToken(request: NextRequest): boolean {
  // Get token from cookie
  const cookieToken = getTokenFromCookie(request);
  if (!cookieToken) {
    log.warn('CSRF validation failed: No token in cookie');
    return false;
  }

  // Get token from header
  const headerToken = getTokenFromHeader(request);
  if (!headerToken) {
    log.warn('CSRF validation failed: No token in header');
    return false;
  }

  // Tokens must match (double-submit pattern)
  if (cookieToken !== headerToken) {
    log.warn('CSRF validation failed: Token mismatch');
    return false;
  }

  // Parse signed token
  const parts = cookieToken.split('.');
  if (parts.length !== 2) {
    log.warn('CSRF validation failed: Invalid token format');
    return false;
  }

  const [token, signature] = parts;

  // Verify signature
  if (!verifyToken(token, signature)) {
    log.warn('CSRF validation failed: Invalid signature');
    return false;
  }

  return true;
}

/**
 * Set CSRF token cookie in response
 */
export function setCSRFCookie(response: NextResponse): NextResponse {
  const token = generateCSRFToken();
  const signature = signToken(token);
  const signedToken = `${token}.${signature}`;

  response.cookies.set(CSRF_COOKIE_NAME, signedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return response;
}

/**
 * CSRF protection middleware
 * 
 * @param request - The incoming request
 * @param options - Configuration options
 * @returns Response if CSRF validation fails, null if passes
 */
export function csrfProtection(
  request: NextRequest,
  options: {
    methods?: string[];
    skipPaths?: string[];
  } = {}
): NextResponse | null {
  const {
    methods = ['POST', 'PUT', 'DELETE', 'PATCH'],
    skipPaths = [],
  } = options;

  // Skip CSRF check for safe methods
  if (!methods.includes(request.method)) {
    return null;
  }

  // Skip CSRF check for whitelisted paths
  const pathname = new URL(request.url).pathname;
  if (skipPaths.some(path => pathname.startsWith(path))) {
    return null;
  }

  // Validate CSRF token
  if (!validateCSRFToken(request)) {
    log.warn({
      method: request.method,
      path: pathname,
      ip: request.ip,
    }, 'CSRF validation failed');

    return NextResponse.json(
      { error: 'CSRF validation failed' },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Get CSRF token for client-side use
 * 
 * @param request - The incoming request
 * @returns CSRF token string
 */
export function getCSRFToken(request: NextRequest): string | null {
  const cookieToken = getTokenFromCookie(request);
  if (!cookieToken) return null;

  const parts = cookieToken.split('.');
  if (parts.length !== 2) return null;

  return parts[0]; // Return unsigned token
}







