/**
 * Next.js Middleware
 * Handles authentication and session management
 */

import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Update Supabase session
  const response = await updateSession(request)
  
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













