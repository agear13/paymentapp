/**
 * API Middleware Utilities
 * Common middleware functions for API routes
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitHeaders,
  rateLimiters,
} from '@/lib/rate-limit'
import { ZodSchema } from 'zod'

/**
 * API Response helper
 */
export function apiResponse<T = any>(
  data: T,
  status: number = 200,
  headers?: HeadersInit
) {
  return NextResponse.json(data, { status, headers })
}

/**
 * API Error response helper
 */
export function apiError(
  message: string,
  status: number = 500,
  code?: string,
  details?: any
) {
  return NextResponse.json(
    {
      error: message,
      code,
      details,
    },
    { status }
  )
}

/**
 * Back-compat helper: some routes import handleApiError
 * Accepts either an Error-like object or a string and returns NextResponse JSON.
 */
export function handleApiError(error: unknown, fallbackStatus: number = 500) {
  if (typeof error === 'string') {
    return apiError(error, fallbackStatus)
  }

  const anyErr = error as any
  return apiError(
    anyErr?.message || 'Internal server error',
    anyErr?.statusCode || anyErr?.status || fallbackStatus,
    anyErr?.code,
    anyErr?.details
  )
}

/**
 * Validate request body with Zod schema
 */
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  try {
    const body = await request.json()
    const data = schema.parse(body)
    return { data, error: null }
  } catch (error: any) {
    return {
      data: null,
      error: apiError(
        'Validation error',
        400,
        'VALIDATION_ERROR',
        error?.errors || error?.message
      ),
    }
  }
}

/**
 * Apply rate limiting to API route
 */
export async function applyRateLimit(
  request: NextRequest,
  limiterType: keyof typeof rateLimiters = 'api'
): Promise<{ allowed: boolean; response?: NextResponse }> {
  const limiter = rateLimiters[limiterType]
  const identifier = getClientIdentifier(request)

  const result = await checkRateLimit(limiter, identifier)

  if (!result.success) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        {
          status: 429,
          headers: getRateLimitHeaders(result),
        }
      ),
    }
  }

  return { allowed: true }
}

/**
 * CORS headers for API routes
 */
export function getCorsHeaders(origin?: string) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  ]

  const isAllowed = origin && allowedOrigins.includes(origin)

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

/**
 * Handle OPTIONS request for CORS
 */
export function handleOptions(request: NextRequest) {
  const origin = request.headers.get('origin')
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin || undefined),
  })
}

/**
 * Wrapper for API routes with common middleware
 */
export function withApiMiddleware(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
  options: {
    rateLimit?: keyof typeof rateLimiters
    cors?: boolean
  } = {}
) {
  return async (request: NextRequest, context?: any) => {
    try {
      // Handle CORS preflight
      if (options.cors && request.method === 'OPTIONS') {
        return handleOptions(request)
      }

      // Apply rate limiting
      if (options.rateLimit) {
        const rateLimitResult = await applyRateLimit(request, options.rateLimit)
        if (!rateLimitResult.allowed) {
          return rateLimitResult.response!
        }
      }

      // Call the handler
      const response = await handler(request, context)

      // Add CORS headers if enabled
      if (options.cors) {
        const origin = request.headers.get('origin')
        const corsHeaders = getCorsHeaders(origin || undefined)
        Object.entries(corsHeaders).forEach(([key, value]) => {
          response.headers.set(key, value)
        })
      }

      return response
    } catch (error: any) {
      console.error('API Error:', error)
      return handleApiError(error)
    }
  }
}
