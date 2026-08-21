import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** Supabase client for auth route handlers that must set session cookies. */
export async function createRouteHandlerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

export type AuthCookieToSet = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

/**
 * Buffer Set-Cookie writes onto the NextResponse we actually return.
 * cookies() from next/headers can succeed in-memory while a later
 * NextResponse.redirect() / NextResponse.json() omits those cookies.
 */
export function createAuthCookieBuffer() {
  const cookiesToSet: AuthCookieToSet[] = [];
  return {
    cookies: cookiesToSet,
    names() {
      return [...new Set(cookiesToSet.map((cookie) => cookie.name))];
    },
    applyTo(response: NextResponse) {
      for (const cookie of cookiesToSet) {
        response.cookies.set(cookie.name, cookie.value, cookie.options as never);
      }
      return response;
    },
  };
}

export type AuthCookieBuffer = ReturnType<typeof createAuthCookieBuffer>;

/** Bind PKCE + session cookies to a specific request/response pair. */
export function createRequestBoundSupabaseClient(
  request: NextRequest,
  buffer: AuthCookieBuffer
) {
  return createServerClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          const merged = new Map<string, { name: string; value: string }>();
          for (const cookie of request.cookies.getAll()) {
            merged.set(cookie.name, { name: cookie.name, value: cookie.value });
          }
          for (const cookie of buffer.cookies) {
            merged.set(cookie.name, { name: cookie.name, value: cookie.value });
          }
          return [...merged.values()];
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            buffer.cookies.push({ name, value, options: options as Record<string, unknown> });
          });
        },
      },
    }
  );
}

export function resolveAuthRedirectOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  return new URL(request.url).origin;
}
