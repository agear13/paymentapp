/**
 * Authentication Middleware for Protected Routes
 * Use in API routes and server actions to enforce authentication + CSRF.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceCsrfForRequest } from '@/lib/security/csrf';
import { AuthError } from './errors';
import { isEmailVerified } from '@/lib/auth/email-verification';
import { assertNoPendingSuspiciousLogin } from '@/lib/auth/verified-session.server';

/**
 * Require authentication for API route handlers (with CSRF on mutating requests).
 * Returns the Supabase user or throws AuthError.
 */
export async function requireAuth(request: NextRequest) {
  const csrfBlock = enforceCsrfForRequest(request);
  if (csrfBlock) {
    throw new AuthError('CSRF validation failed', 'FORBIDDEN');
  }

  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError('Authentication required', 'UNAUTHENTICATED');
  }

  if (!isEmailVerified(user)) {
    throw new AuthError('Please verify your email address before continuing.', 'EMAIL_NOT_CONFIRMED');
  }

  await assertNoPendingSuspiciousLogin(user.id);

  return user;
}

/**
 * Safe variant returning user or NextResponse (no throw).
 */
export async function requireAuthOrResponse(request: NextRequest) {
  const csrfBlock = enforceCsrfForRequest(request);
  if (csrfBlock) {
    return { user: null as null, response: csrfBlock };
  }

  try {
    const user = await requireAuth(request);
    return { user, response: null as null };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        user: null as null,
        response: NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode }
        ),
      };
    }
    return {
      user: null as null,
      response: NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
    };
  }
}

/**
 * Middleware to optionally get authenticated user
 * Returns user if authenticated, null otherwise (no error thrown)
 */
export async function getAuthUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

/**
 * API Route wrapper that requires authentication
 */
export function withAuth<T = unknown>(
  handler: (request: NextRequest, context: { user: NonNullable<Awaited<ReturnType<typeof getAuthUser>>> }) => Promise<Response>
) {
  return async (request: NextRequest, context?: T) => {
    try {
      const user = await requireAuth(request);
      return handler(request, { ...(context as object), user });
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode }
        );
      }

      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

/**
 * Check if user belongs to organization
 */
export async function requireOrganizationAccess(userId: string, organizationId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', organizationId)
    .single();

  if (error || !data) {
    throw new AuthError('Organization not found or access denied', 'FORBIDDEN');
  }

  return data;
}
