/**
 * Authentication Middleware for Protected Routes
 * Use in API routes and server actions to enforce authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AuthError } from './errors'

/**
 * Middleware to require authentication
 * Returns user if authenticated, throws error otherwise
 */
export async function requireAuth() {
  const supabase = await createClient()
  
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new AuthError('Authentication required', 'UNAUTHENTICATED')
  }

  return user
}

/**
 * Middleware to optionally get authenticated user
 * Returns user if authenticated, null otherwise (no error thrown)
 */
export async function getAuthUser() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

/**
 * API Route wrapper that requires authentication
 */
export function withAuth<T = any>(
  handler: (request: NextRequest, context: { user: any }) => Promise<Response>
) {
  return async (request: NextRequest, context?: any) => {
    try {
      const user = await requireAuth()
      return handler(request, { ...context, user })
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode }
        )
      }
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Check if user belongs to organization
 */
export async function requireOrganizationAccess(
  userId: string,
  organizationId: string
) {
  const supabase = await createClient()
  
  // Query to check if user has access to organization
  // This will need to be implemented based on your user_organizations table
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', organizationId)
    .single()

  if (error || !data) {
    throw new AuthError('Organization not found or access denied', 'FORBIDDEN')
  }

  return data
}













