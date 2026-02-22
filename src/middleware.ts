/**
 * Next.js Middleware
 * Handles authentication, session management, and beta lockdown route protection
 */

import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Beta admin emails - must match src/lib/auth/admin.ts
 * Duplicated here because middleware runs in edge runtime and can't import from lib
 */
const BETA_ADMIN_EMAILS = ['alishajayne13@gmail.com'];

function isBetaAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return BETA_ADMIN_EMAILS.some(adminEmail => adminEmail.toLowerCase() === normalized);
}

/**
 * Route prefixes restricted to beta admins only
 * These are Revenue Share and Platform Preview features
 */
const BETA_RESTRICTED_ROUTE_PREFIXES = [
  '/dashboard/partners',
  '/dashboard/programs',
  '/dashboard/consultant',
  '/dashboard/platform-preview',
];

/**
 * Check if a pathname matches any restricted route prefix
 */
function isRestrictedRoute(pathname: string): boolean {
  return BETA_RESTRICTED_ROUTE_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

/**
 * Get user email from Supabase session in middleware context
 */
async function getUserEmailFromRequest(request: NextRequest): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) return null;
  
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // no-op in middleware read context
      },
    },
  });
  
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return null;
    return data.user.email ?? null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  // Update Supabase session
  const response = await updateSession(request)
  
  const pathname = request.nextUrl.pathname;
  
  // Beta lockdown: check if route is restricted and user is not admin
  const betaLockdownEnabled = process.env.BETA_LOCKDOWN_MODE !== 'false';
  
  if (betaLockdownEnabled && isRestrictedRoute(pathname)) {
    const userEmail = await getUserEmailFromRequest(request);
    
    if (!isBetaAdminEmail(userEmail)) {
      // Redirect non-admins to dashboard
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/dashboard';
      return NextResponse.redirect(redirectUrl);
    }
  }
  
  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  )
  
  // Prevent HTML/app routes from being cached (prevents stale HTML pointing to new chunks)
  // Note: This does NOT affect /_next/static/* or /_next/image/* (excluded by matcher)
  response.headers.set('Cache-Control', 'no-store')
  
  return response
}

export const config = {
  matcher: [
    /*
     * Only match dashboard routes that require authentication.
     * Public routes like /r/*, /review/*, /huntpay/*, /pay/*, etc. are not matched.
     */
    '/dashboard/:path*',
  ],
}













