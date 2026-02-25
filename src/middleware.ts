/**
 * Next.js Middleware
 * 
 * Handles route protection and security headers.
 * 
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  EDGE RUNTIME - ZERO SUPABASE IMPORTS                                         ║
 * ║                                                                               ║
 * ║  This middleware runs on Edge Runtime with NO Supabase dependencies.         ║
 * ║  - We detect auth state by checking for Supabase session cookies             ║
 * ║  - We do NOT verify JWTs here (deferred to server components/API routes)     ║
 * ║  - We do NOT import @supabase/ssr, @supabase/supabase-js, or any lib/*       ║
 * ║                                                                               ║
 * ║  Session refresh happens in server components via @supabase/ssr.               ║
 * ║  This middleware only does lightweight route gating based on cookie presence.║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 * 
 * AUTHORIZATION (IMPORTANT):
 * - JWT email extraction in this file is BEST-EFFORT ONLY and must NOT be trusted
 *   for authorization. It is used only for UX (redirecting non-admins away from
 *   restricted dashboard paths). Server components and API routes MUST enforce
 *   real authorization (e.g. requireAuth + isBetaAdminEmail / checkAdminAuth).
 */

import { NextResponse, type NextRequest } from 'next/server'

/**
 * Beta admin emails - must match src/lib/auth/admin-shared.ts
 * Duplicated here because middleware can't safely import from lib modules
 */
const BETA_ADMIN_EMAILS = ['alishajayne13@gmail.com'];

/**
 * Single source of truth for path prefixes restricted to beta admins.
 * Used by isRestrictedPath() for middleware gating. Audit this list when adding
 * new partner/program/consultant/platform-preview routes.
 */
const RESTRICTED_PATH_PREFIXES = [
  '/dashboard/partners',
  '/dashboard/programs',
  '/dashboard/consultant',
  '/dashboard/platform-preview',
];

/**
 * Returns true if the pathname is restricted to beta admins.
 * Centralized here so the route list is easy to audit.
 */
function isRestrictedPath(pathname: string): boolean {
  return RESTRICTED_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

/**
 * Decode base64url string to UTF-8. Adds padding so length is multiple of 4 before atob.
 */
function base64UrlDecode(base64url: string): string {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) {
    base64 += '='.repeat(4 - pad);
  }
  return atob(base64);
}

/**
 * Lightweight session detection from Supabase cookies.
 *
 * Supabase stores session in cookies with pattern:
 * - sb-<project-ref>-auth-token (unchunked)
 * - sb-<project-ref>-auth-token.0, .1, .2... (chunked format for large tokens)
 *
 * We extract email from the JWT payload for beta admin redirects only.
 * JWT email is BEST-EFFORT and NOT trusted for authorization. Server/API routes
 * must enforce real authorization (verify session and check allowlist server-side).
 */
function getSessionFromCookies(request: NextRequest): { hasSession: boolean; email: string | null } {
  const cookies = request.cookies.getAll();

  // Prefer unchunked cookie: exactly sb-<ref>-auth-token (no .0, .1 suffix)
  const unchunked = cookies.find(
    (c) =>
      c.name.startsWith('sb-') &&
      c.name.endsWith('-auth-token') &&
      !/\.\d+$/.test(c.name)
  );
  if (unchunked?.value) {
    const result = parseTokenValue(unchunked.value);
    return { hasSession: true, email: result };
  }

  // Chunked: find base name from .0 chunk and reconstruct .0, .1, .2... in order
  const chunkedByBase = new Map<string, { index: number; value: string }[]>();
  for (const c of cookies) {
    if (!c.name.startsWith('sb-') || !c.name.includes('-auth-token')) continue;
    const match = c.name.match(/^(.+)-auth-token\.(\d+)$/);
    if (!match) continue;
    const baseName = `${match[1]}-auth-token`;
    const index = parseInt(match[2], 10);
    if (!chunkedByBase.has(baseName)) chunkedByBase.set(baseName, []);
    chunkedByBase.get(baseName)!.push({ index, value: c.value });
  }
  for (const [, entries] of chunkedByBase) {
    entries.sort((a, b) => a.index - b.index);
    const hasZero = entries.some((e) => e.index === 0);
    if (!hasZero) {
      // Only non-.0 chunks exist: session present but we can't reconstruct token
      return { hasSession: true, email: null };
    }
    const tokenValue = entries.map((e) => e.value).join('');
    const result = parseTokenValue(tokenValue);
    return { hasSession: true, email: result };
  }

  return { hasSession: false, email: null };
}

/**
 * Best-effort: parse token value to extract email from JWT payload. Not used for authorization.
 * Returns email or null. On any failure returns null (caller already has hasSession from cookie).
 */
function parseTokenValue(tokenValue: string): string | null {
  try {
    let jwt = tokenValue;
    if (tokenValue.startsWith('{') || tokenValue.startsWith('%7B')) {
      const decoded = tokenValue.startsWith('%7B')
        ? decodeURIComponent(tokenValue)
        : tokenValue;
      const parsed = JSON.parse(decoded);
      jwt = parsed.access_token || parsed.token || tokenValue;
    }
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const jsonPayload = base64UrlDecode(payload);
    const claims = JSON.parse(jsonPayload);
    return claims.email || null;
  } catch {
    return null;
  }
}

/**
 * Check if email is in beta admin allowlist
 */
function isBetaAdminEmail(email: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return BETA_ADMIN_EMAILS.some(adminEmail => adminEmail.toLowerCase() === normalized);
}

const DEBUG_MIDDLEWARE = process.env.DEBUG_MIDDLEWARE === 'true';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Create response that we'll modify
  const response = NextResponse.next({ request });

  // Detect session from cookies (lightweight, no Supabase import)
  const { hasSession, email } = getSessionFromCookies(request);

  // DEV only: log cookie NAMES and pathname decisions (never cookie values or tokens)
  if (DEBUG_MIDDLEWARE) {
    const cookieNames = request.cookies.getAll().map((c) => c.name);
    // eslint-disable-next-line no-console
    console.log('[middleware] pathname=', pathname, 'cookieNames=', cookieNames.join(','), 'hasSession=', hasSession, 'hasEmail=', !!email);
  }

  // Route protection logic
  const isAuthRoute = pathname.startsWith('/auth');
  const isDashboardRoute = pathname.startsWith('/dashboard');
  const restricted = isRestrictedPath(pathname);

  if (DEBUG_MIDDLEWARE) {
    // eslint-disable-next-line no-console
    console.log('[middleware] isAuthRoute=', isAuthRoute, 'isDashboardRoute=', isDashboardRoute, 'isRestrictedPath=', restricted);
  }

  // Redirect unauthenticated users from dashboard to login
  if (!hasSession && isDashboardRoute) {
    if (DEBUG_MIDDLEWARE) { console.log('[middleware] decision=redirect_to_login'); }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/auth/login';
    redirectUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users from auth pages to dashboard (except callback routes)
  const isAuthCallbackRoute = pathname.startsWith('/auth/callback');
  if (hasSession && isAuthRoute && !isAuthCallbackRoute) {
    if (DEBUG_MIDDLEWARE) { console.log('[middleware] decision=redirect_to_dashboard'); }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    return NextResponse.redirect(redirectUrl);
  }

  // Beta lockdown: restrict certain routes to admin emails only
  const betaLockdownEnabled = process.env.BETA_LOCKDOWN_MODE !== 'false';

  if (betaLockdownEnabled && restricted) {
    // If we can't determine email or user is not admin, redirect (UX only; server/API enforce auth)
    if (!isBetaAdminEmail(email)) {
      if (DEBUG_MIDDLEWARE) { console.log('[middleware] decision=redirect_restricted_to_dashboard'); }
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/dashboard';
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (DEBUG_MIDDLEWARE) { console.log('[middleware] decision=next'); }
  
  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Cache-Control', 'no-store');
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match dashboard and auth routes for session management.
     * Public routes like /r/*, /review/*, /huntpay/*, /pay/*, etc. are not matched.
     */
    '/dashboard/:path*',
    '/auth/:path*',
  ],
};













