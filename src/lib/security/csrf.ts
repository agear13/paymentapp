/**
 * CSRF Protection
 * 
 * Protects against Cross-Site Request Forgery attacks
 * Uses double-submit cookie pattern with signed tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { log } from '@/lib/logger';
import { resolveCsrfSecret } from '@/lib/security/csrf-secret.server';
import {
  hasSupabaseSessionCookie,
  isCsrfExemptPath,
  isMutatingMethod,
} from '@/lib/security/csrf-policy';
function getCsrfSecret(): string {
  return resolveCsrfSecret();
}
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
  const hmac = crypto.createHmac('sha256', getCsrfSecret());
  hmac.update(token);
  return hmac.digest('base64');
}

/**
 * Verify a CSRF token signature
 */
function verifyToken(token: string, signature: string): boolean {
  const expected = signToken(token);
  const expectedBuffer = Buffer.from(expected, 'base64');
  const signatureBuffer = Buffer.from(signature, 'base64');
  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

function isSignedCsrfTokenValid(signedToken: string): boolean {
  const parts = signedToken.split('.');
  if (parts.length !== 2) return false;
  const [token, signature] = parts;
  try {
    return verifyToken(token, signature);
  } catch {
    return false;
  }
}

/**
 * Cookie values in the Cookie header may arrive percent-encoded (%3D, %2F) while
 * x-csrf-token is sent decoded. Normalize before compare or verify.
 */
function decodeCsrfCookieValue(rawCookieValue: string): string {
  try {
    return decodeURIComponent(rawCookieValue);
  } catch {
    return rawCookieValue;
  }
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

  // Use slice — token signatures are base64 and may contain '=' padding.
  const rawCookieValue = csrfCookie.slice(`${CSRF_COOKIE_NAME}=`.length);
  return decodeCsrfCookieValue(rawCookieValue);
}

/**
 * Extract CSRF token from header
 */
function getTokenFromHeader(request: NextRequest): string | null {
  return request.headers.get(CSRF_HEADER_NAME);
}

function decodeUriComponentChangesValue(value: string): boolean {
  try {
    return decodeURIComponent(value) !== value;
  } catch {
    return false;
  }
}

function firstCsrfTokenDivergenceIndex(
  cookieToken: string,
  headerToken: string
): number | null {
  const maxLength = Math.max(cookieToken.length, headerToken.length);
  for (let index = 0; index < maxLength; index += 1) {
    const cookieCharCode =
      index < cookieToken.length ? cookieToken.charCodeAt(index) : null;
    const headerCharCode =
      index < headerToken.length ? headerToken.charCodeAt(index) : null;
    if (cookieCharCode !== headerCharCode) {
      return index;
    }
  }
  return null;
}

export type CsrfValidationFailureReason =
  | 'missing_cookie'
  | 'missing_header'
  | 'token_mismatch'
  | 'invalid_signature';

function maskCsrfTokenPreview(token: string | null): string | null {
  if (!token) return null;
  if (token.length <= 12) return '[redacted]';
  return `${token.slice(0, 6)}…${token.slice(-4)} (len=${token.length})`;
}

export function diagnoseCsrfValidation(request: NextRequest): {
  valid: boolean;
  reason: CsrfValidationFailureReason | null;
} {
  const cookieToken = getTokenFromCookie(request);
  const headerToken = getTokenFromHeader(request);

  if (!cookieToken) {
    return { valid: false, reason: 'missing_cookie' };
  }
  if (!headerToken) {
    return { valid: false, reason: 'missing_header' };
  }
  if (cookieToken !== headerToken) {
    return { valid: false, reason: 'token_mismatch' };
  }
  if (!isSignedCsrfTokenValid(cookieToken)) {
    return { valid: false, reason: 'invalid_signature' };
  }
  return { valid: true, reason: null };
}

function logCsrfValidationFailure(request: NextRequest, pathname: string): void {
  const cookieToken = getTokenFromCookie(request);
  const headerToken = getTokenFromHeader(request);
  const { reason } = diagnoseCsrfValidation(request);
  const firstDivergenceIndex =
    cookieToken && headerToken
      ? firstCsrfTokenDivergenceIndex(cookieToken, headerToken)
      : null;

  log.warn('CSRF validation failed', {
    endpoint: pathname,
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
    csrfCookiePresent: Boolean(cookieToken),
    csrfHeaderPresent: Boolean(headerToken),
    csrfHeaderValue: maskCsrfTokenPreview(headerToken),
    validationResult: reason ?? 'unknown',
    cookieTokenLength: cookieToken?.length ?? 0,
    headerTokenLength: headerToken?.length ?? 0,
    cookieDecodeUriChanged: cookieToken
      ? decodeUriComponentChangesValue(cookieToken)
      : false,
    headerDecodeUriChanged: headerToken
      ? decodeUriComponentChangesValue(headerToken)
      : false,
    firstDivergenceIndex,
  });
}

/**
 * Validate CSRF token from request
 * 
 * @param request - The incoming request
 * @returns True if CSRF token is valid
 */
export function validateCSRFToken(request: NextRequest): boolean {
  return diagnoseCsrfValidation(request).valid;
}

/**
 * Set CSRF token cookie in response
 */
export function createSignedCsrfToken(): string {
  const token = generateCSRFToken();
  const signature = signToken(token);
  return `${token}.${signature}`;
}

/**
 * Returns a valid signed CSRF token for dashboard clients.
 * Reuses the existing csrf_token cookie when its signature is valid so repeated
 * bootstrap GETs do not rotate the cookie away from the in-memory client token.
 */
export function resolveClientCsrfToken(request: NextRequest): string {
  const cookieToken = getTokenFromCookie(request);
  if (cookieToken && isSignedCsrfTokenValid(cookieToken)) {
    return cookieToken;
  }
  return createSignedCsrfToken();
}

export function setCSRFCookie(response: NextResponse, signedToken?: string): NextResponse {
  const value = signedToken ?? createSignedCsrfToken();

  response.cookies.set(CSRF_COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24,
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
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      undefined;
    const userAgent = request.headers.get('user-agent') ?? undefined;

    logCsrfValidationFailure(request, pathname);

    void import('@/lib/audit/audit-log').then(({ logSecurityEvent, AuditEventType, AuditSeverity }) =>
      logSecurityEvent({
        eventType: AuditEventType.SECURITY_CSRF_VIOLATION,
        severity: AuditSeverity.WARNING,
        ipAddress: ip,
        userAgent,
        resource: pathname,
        reason: 'CSRF validation failed',
      })
    );

    return NextResponse.json(
      { error: 'CSRF validation failed' },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Enforce CSRF for cookie-authenticated API mutations.
 * Returns 403 response when invalid; null when check passes or is not required.
 */
export function enforceCsrfForRequest(request: NextRequest): NextResponse | null {
  if (!isMutatingMethod(request.method)) return null;

  const pathname = new URL(request.url).pathname;
  if (isCsrfExemptPath(pathname)) return null;

  const cookieHeader = request.headers.get('cookie');
  if (!hasSupabaseSessionCookie(cookieHeader)) return null;

  if (request.headers.get('x-internal-admin-token')) return null;
  if (request.headers.get('x-cron-secret')) return null;

  return csrfProtection(request, { skipPaths: [] });
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







