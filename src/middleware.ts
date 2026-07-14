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

import { NextResponse, type NextRequest } from 'next/server';
import {
  CONTENT_SECURITY_POLICY,
  CONTENT_SECURITY_POLICY_PRODUCTION,
} from '@/lib/security/content-security-policy';
import {
  isBetaAdminEmail,
  isRabbitHolePilotEmail,
  isStraitExperiencesPilotEmail,
} from '@/lib/auth/admin-shared';
import {
  isDealNetworkPilotDashboardPathAllowed,
  normalizeMiddlewarePathname,
} from '@/lib/middleware/pilot-dashboard-allowlist';

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
  '/dashboard/partner-preview',
  '/dashboard/agreement-analyzer',
];

/**
 * Returns true if the pathname is restricted to beta admins.
 * Centralized here so the route list is easy to audit.
 */
function isRestrictedPath(pathname: string): boolean {
  return RESTRICTED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isRabbitHoleDealNetworkPath(pathname: string): boolean {
  return (
    pathname === '/dashboard/partners/deal-network' ||
    pathname.startsWith('/dashboard/partners/deal-network/')
  );
}

/**
 * Pilot allowlist: static (admin-shared) + RABBIT_HOLE_PILOT_EMAILS env (comma-separated).
 * Beta admin wins — must match dashboard-product.server.ts / partners layout.
 */
function isRabbitHolePilotSessionUser(email: string | null): boolean {
  if (!email) return false;
  if (isBetaAdminEmail(email)) return false;
  if (isRabbitHolePilotEmail(email)) return true;
  const raw = process.env.RABBIT_HOLE_PILOT_EMAILS;
  if (!raw) return false;
  const emails = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return emails.includes(email.trim().toLowerCase());
}

/** Strait / project-coordination pilot (same Deal Network path carve-out as Rabbit Hole in beta lockdown). */
function isStraitExperiencesPilotSessionUser(email: string | null): boolean {
  if (!email) return false;
  if (isBetaAdminEmail(email)) return false;
  if (isRabbitHolePilotSessionUser(email)) return false;
  if (isStraitExperiencesPilotEmail(email)) return true;
  const raw = process.env.STRAIT_EXPERIENCES_PILOT_EMAILS;
  if (!raw) return false;
  const emails = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return emails.includes(email.trim().toLowerCase());
}

function isDealNetworkMinimalPilotSessionUser(email: string | null): boolean {
  return isRabbitHolePilotSessionUser(email) || isStraitExperiencesPilotSessionUser(email);
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
function getSessionFromCookies(request: NextRequest): {
  hasSession: boolean;
  email: string | null;
  emailVerified: boolean | null;
} {
  const cookies = request.cookies.getAll();

  const unchunked = cookies.find(
    (c) =>
      c.name.startsWith('sb-') &&
      c.name.endsWith('-auth-token') &&
      !/\.\d+$/.test(c.name)
  );
  if (unchunked?.value) {
    const parsed = parseTokenValue(unchunked.value);
    return { hasSession: true, email: parsed.email, emailVerified: parsed.emailVerified };
  }

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
      return { hasSession: true, email: null, emailVerified: null };
    }
    const tokenValue = entries.map((e) => e.value).join('');
    const parsed = parseTokenValue(tokenValue);
    return { hasSession: true, email: parsed.email, emailVerified: parsed.emailVerified };
  }

  return { hasSession: false, email: null, emailVerified: null };
}

type ParsedSessionToken = {
  email: string | null;
  emailVerified: boolean | null;
};

function parseTokenValue(tokenValue: string): ParsedSessionToken {
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
    if (parts.length !== 3) return { email: null, emailVerified: null };
    const payload = parts[1];
    const jsonPayload = base64UrlDecode(payload);
    const claims = JSON.parse(jsonPayload);
    const email = claims.email || null;
    if (claims.email_confirmed_at) {
      return { email, emailVerified: true };
    }
    const provider = claims.app_metadata?.provider as string | undefined;
    if (provider && provider !== 'email') {
      return { email, emailVerified: true };
    }
    if (email) {
      return { email, emailVerified: false };
    }
    return { email: null, emailVerified: null };
  } catch {
    return { email: null, emailVerified: null };
  }
}

const DEBUG_MIDDLEWARE = process.env.DEBUG_MIDDLEWARE === 'true';

function nextWithPathnameAndSecurityHeaders(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Cache-Control', 'no-store');
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  const csp =
    process.env.NODE_ENV === 'production'
      ? CONTENT_SECURITY_POLICY_PRODUCTION
      : CONTENT_SECURITY_POLICY;
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Block auth debug page in production (exposes session cookies)
  if (process.env.NODE_ENV === 'production' && pathname === '/auth/debug') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/auth/login';
    return NextResponse.redirect(redirectUrl);
  }

  // Detect session from cookies (lightweight, no Supabase import)
  const { hasSession, email, emailVerified } = getSessionFromCookies(request);

  // DEV only: log cookie NAMES and pathname decisions (never cookie values or tokens)
  if (DEBUG_MIDDLEWARE) {
    const cookieNames = request.cookies.getAll().map((c) => c.name);
    // eslint-disable-next-line no-console
    console.log('[middleware] pathname=', pathname, 'cookieNames=', cookieNames.join(','), 'hasSession=', hasSession, 'hasEmail=', !!email);
  }

  // Route protection logic
  const isAuthRoute = pathname.startsWith('/auth');
  const isDashboardRoute =
    pathname.startsWith('/dashboard') ||
    pathname === '/marketing' ||
    pathname.startsWith('/marketing/');
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
  const isVerifyEmailRoute = pathname.startsWith('/auth/verify-email');
  const isConfirmLoginRoute = pathname.startsWith('/auth/confirm-login');
  const isResetPasswordRoute = pathname.startsWith('/auth/reset-password');
  const isAuthUtilityRoute = isVerifyEmailRoute || isConfirmLoginRoute || isResetPasswordRoute;

  if (hasSession && isAuthRoute && !isAuthCallbackRoute && !isAuthUtilityRoute) {
    if (DEBUG_MIDDLEWARE) { console.log('[middleware] decision=redirect_to_dashboard'); }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = emailVerified === false ? '/auth/verify-email' : '/dashboard';
    return NextResponse.redirect(redirectUrl);
  }

  if (hasSession && isDashboardRoute && emailVerified === false) {
    if (DEBUG_MIDDLEWARE) { console.log('[middleware] decision=redirect_to_verify_email'); }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/auth/verify-email';
    return NextResponse.redirect(redirectUrl);
  }

  // Rabbit Hole + Strait pilots: deal network + invoices + recurring + /dashboard hub only (same allowed set)
  if (
    hasSession &&
    isDashboardRoute &&
    email &&
    isDealNetworkMinimalPilotSessionUser(email)
  ) {
    const pathForPilot = normalizeMiddlewarePathname(pathname);
    const pilotAllowed = isDealNetworkPilotDashboardPathAllowed(pathname);
    if (DEBUG_MIDDLEWARE || process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[middleware] MIDDLEWARE PATH:', pathname, 'normalized:', pathForPilot, 'pilotAllowed:', pilotAllowed);
    }
    if (!pilotAllowed) {
      if (DEBUG_MIDDLEWARE) { console.log('[middleware] decision=redirect_pilot_to_deal_network'); }
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/dashboard/partners/deal-network';
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Beta lockdown: restrict certain routes to admin emails only
  // Only redirect when we have a definite non-admin (email parsed and not in allowlist).
  // When email is null (JWT parse failed), allow through so server-side can enforce (avoids
  // incorrectly blocking admins whose cookie we couldn't parse).
  const betaLockdownEnabled = process.env.BETA_LOCKDOWN_MODE !== 'false';

  if (betaLockdownEnabled && restricted) {
    const pilotOnDealNetwork =
      email !== null &&
      isDealNetworkMinimalPilotSessionUser(email) &&
      isRabbitHoleDealNetworkPath(pathname);

    if (pilotOnDealNetwork) {
      if (DEBUG_MIDDLEWARE) { console.log('[middleware] decision=next_pilot_deal_network'); }
      return nextWithPathnameAndSecurityHeaders(request, pathname);
    }

    const isKnownNonAdmin = email !== null && !isBetaAdminEmail(email);
    if (isKnownNonAdmin) {
      if (DEBUG_MIDDLEWARE) { console.log('[middleware] decision=redirect_restricted_to_dashboard'); }
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/dashboard';
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (DEBUG_MIDDLEWARE) { console.log('[middleware] decision=next'); }

  return nextWithPathnameAndSecurityHeaders(request, pathname);
}

export const config = {
  matcher: [
    /*
     * Match dashboard and auth routes for session management.
     * Public routes like /r/*, /review/*, /huntpay/*, /pay/*, etc. are not matched.
     */
    '/dashboard/:path*',
    '/marketing',
    '/marketing/:path*',
    '/auth/:path*',
  ],
};
