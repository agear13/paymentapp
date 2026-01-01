/**
 * Supabase helpers
 * - updateSession(request): used by Next.js middleware to refresh session + redirect
 * - requireAuth(request): used by API route handlers to read authenticated user
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    // Avoid leaking values, but be explicit about what’s missing
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  return { url, anonKey }
}

/**
 * Safe wrapper around supabase.auth.getUser() that never throws on missing session.
 * Missing session is expected for public pages (e.g. /pay/[shortCode]).
 */
async function safeGetUser(supabase: any) {
  try {
    const { data, error } = await supabase.auth.getUser()

    // If there's any auth error (including missing session), treat as unauthenticated
    if (error) return null

    return data?.user ?? null
  } catch (err: any) {
    // Supabase sometimes throws AuthSessionMissingError etc. in server/edge contexts
    if (err?.name === 'AuthSessionMissingError') return null
    return null
  }
}

/**
 * Middleware helper: refreshes the session and applies basic route protection/redirects.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const { url, anonKey } = getSupabaseEnv()

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        // IMPORTANT: apply cookie options, not just name/value
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value, options)
        })

        supabaseResponse = NextResponse.next({ request })

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options)
        })
      },
    },
  })

  // IMPORTANT: use safe wrapper (public routes can have no session)
  const user = await safeGetUser(supabase)

  const pathname = request.nextUrl.pathname

  const isAuthRoute = pathname.startsWith('/auth')
  const isDashboardRoute = pathname.startsWith('/dashboard')
  const isApiRoute = pathname.startsWith('/api')

  // Public routes you NEVER want to block
  const isPublicApiRoute = pathname.startsWith('/api/public')
  const isPayRoute = pathname.startsWith('/pay')

  // If user is not logged in and trying to access protected routes
  if (!user && (isDashboardRoute || isApiRoute)) {
    // Allow public API and /pay/** always
    if (isPublicApiRoute || isPayRoute) return supabaseResponse

    // For API routes, let them through (handlers will return 401/403)
    if (isApiRoute) return supabaseResponse

    // For dashboard routes, redirect to login
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth/login'
    redirectUrl.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If user is logged in and trying to access auth routes, redirect to dashboard
  if (user && isAuthRoute) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

/**
 * API helper: returns the authenticated Supabase user (or null).
 * Use inside app/api/** route handlers.
 */
export async function requireAuth(request: NextRequest) {
  const { url, anonKey } = getSupabaseEnv()

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      // For route handlers we read cookies from the request
      getAll() {
        return request.cookies.getAll()
      },
      // We generally don't want to mutate cookies in API handlers,
      // but Supabase expects this interface.
      setAll() {
        // no-op
      },
    },
  })

  // IMPORTANT: safe wrapper (don't throw if session missing)
  const user = await safeGetUser(supabase)

  return user ?? null
}
