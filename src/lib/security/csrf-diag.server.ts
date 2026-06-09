import 'server-only';

import { NextRequest } from 'next/server';
import { sha256Hex } from '@/lib/security/csrf-hash.server';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

export type CsrfFailingBranch =
  | 'none'
  | 'no_cookie'
  | 'no_header'
  | 'cookie_header_mismatch'
  | 'invalid_token_format'
  | 'invalid_signature';

/** TEMP: remove after bootstrap-workspace CSRF 403 debugging. */
export type CsrfValidationDiagnostics = {
  hasCsrfCookie: boolean;
  hasCsrfHeader: boolean;
  cookieMatchesHeader: boolean;
  signatureValid: boolean;
  invalidTokenFormat: boolean;
  failingBranch: CsrfFailingBranch;
  cookieTokenPreview: string | null;
  headerTokenPreview: string | null;
  cookieTokenSha256: string | null;
  headerTokenSha256: string | null;
};

function tokenSha256(value: string | null): string | null {
  if (!value) return null;
  return sha256Hex(value);
}

function previewToken(value: string | null): string | null {
  if (!value) return null;
  return `${value.slice(0, 12)}...`;
}

function getTokenFromCookie(request: NextRequest): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const csrfCookie = cookies.find((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`));
  if (!csrfCookie) return null;

  return csrfCookie.slice(`${CSRF_COOKIE_NAME}=`.length);
}

function getTokenFromHeader(request: NextRequest): string | null {
  return request.headers.get(CSRF_HEADER_NAME);
}

export function diagnoseCsrfValidation(
  request: NextRequest,
  verifySignature: (token: string, signature: string) => boolean
): CsrfValidationDiagnostics {
  const cookieToken = getTokenFromCookie(request);
  const headerToken = getTokenFromHeader(request);
  const hasCsrfCookie = cookieToken !== null;
  const hasCsrfHeader = headerToken !== null;

  if (!hasCsrfCookie) {
    return {
      hasCsrfCookie: false,
      hasCsrfHeader,
      cookieMatchesHeader: false,
      signatureValid: false,
      invalidTokenFormat: false,
      failingBranch: 'no_cookie',
      cookieTokenPreview: null,
      headerTokenPreview: previewToken(headerToken),
      cookieTokenSha256: null,
      headerTokenSha256: tokenSha256(headerToken),
    };
  }

  if (!hasCsrfHeader) {
    return {
      hasCsrfCookie: true,
      hasCsrfHeader: false,
      cookieMatchesHeader: false,
      signatureValid: false,
      invalidTokenFormat: false,
      failingBranch: 'no_header',
      cookieTokenPreview: previewToken(cookieToken),
      headerTokenPreview: null,
      cookieTokenSha256: tokenSha256(cookieToken),
      headerTokenSha256: null,
    };
  }

  const cookieMatchesHeader = cookieToken === headerToken;
  if (!cookieMatchesHeader) {
    return {
      hasCsrfCookie: true,
      hasCsrfHeader: true,
      cookieMatchesHeader: false,
      signatureValid: false,
      invalidTokenFormat: false,
      failingBranch: 'cookie_header_mismatch',
      cookieTokenPreview: previewToken(cookieToken),
      headerTokenPreview: previewToken(headerToken),
      cookieTokenSha256: tokenSha256(cookieToken),
      headerTokenSha256: tokenSha256(headerToken),
    };
  }

  const parts = cookieToken.split('.');
  if (parts.length !== 2) {
    return {
      hasCsrfCookie: true,
      hasCsrfHeader: true,
      cookieMatchesHeader: true,
      signatureValid: false,
      invalidTokenFormat: true,
      failingBranch: 'invalid_token_format',
      cookieTokenPreview: previewToken(cookieToken),
      headerTokenPreview: previewToken(headerToken),
      cookieTokenSha256: tokenSha256(cookieToken),
      headerTokenSha256: tokenSha256(headerToken),
    };
  }

  const [token, signature] = parts;
  let signatureValid = false;
  try {
    signatureValid = verifySignature(token, signature);
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    return {
      hasCsrfCookie: true,
      hasCsrfHeader: true,
      cookieMatchesHeader: true,
      signatureValid: false,
      invalidTokenFormat: false,
      failingBranch: 'invalid_signature',
      cookieTokenPreview: previewToken(cookieToken),
      headerTokenPreview: previewToken(headerToken),
      cookieTokenSha256: tokenSha256(cookieToken),
      headerTokenSha256: tokenSha256(headerToken),
    };
  }

  return {
    hasCsrfCookie: true,
    hasCsrfHeader: true,
    cookieMatchesHeader: true,
    signatureValid: true,
    invalidTokenFormat: false,
    failingBranch: 'none',
    cookieTokenPreview: previewToken(cookieToken),
    headerTokenPreview: previewToken(headerToken),
    cookieTokenSha256: tokenSha256(cookieToken),
    headerTokenSha256: tokenSha256(headerToken),
  };
}
