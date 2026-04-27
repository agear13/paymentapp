/**
 * Rate Limiting Configuration
 * Protects API routes from abuse using Upstash Redis
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const RATE_LIMIT_TIMEOUT_MS = Number.parseInt(process.env.RATE_LIMIT_TIMEOUT_MS || '60', 10)

// Create Redis client
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

// Rate limiters for different endpoints
export const rateLimiters = {
  // Strict rate limit for authentication endpoints
  auth: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '15 m'), // 5 requests per 15 minutes
        analytics: false,
        prefix: 'ratelimit:auth',
        ephemeralCache: new Map(),
      })
    : null,

  // Standard rate limit for API endpoints
  api: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '15 m'), // 100 requests per 15 minutes
        analytics: false,
        prefix: 'ratelimit:api',
        ephemeralCache: new Map(),
      })
    : null,

  // Generous rate limit for public payment pages
  public: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '1 m'), // 30 requests per minute
        analytics: false,
        prefix: 'ratelimit:public',
        ephemeralCache: new Map(),
      })
    : null,

  // Webhook rate limit
  webhook: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(1000, '1 m'), // 1000 requests per minute
        analytics: false,
        prefix: 'ratelimit:webhook',
        ephemeralCache: new Map(),
      })
    : null,

  // Polling rate limit - higher limit for frequent status checks
  polling: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(300, '15 m'), // 300 requests per 15 minutes (1 per 3 seconds)
        analytics: false,
        prefix: 'ratelimit:polling',
        ephemeralCache: new Map(),
      })
    : null,
}

/**
 * Get client identifier from request
 */
export function getClientIdentifier(request: Request): string {
  // Try to get IP from various headers
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')

  const ip = forwarded?.split(',')[0] || realIp || cfConnectingIp || 'unknown'

  return ip
}

/**
 * Check rate limit for a request
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{
  success: boolean
  limit: number
  remaining: number
  reset: number
}> {
  // If no limiter configured (development), allow all requests
  if (!limiter) {
    return {
      success: true,
      limit: 999999,
      remaining: 999999,
      reset: Date.now() + 60000,
    }
  }

  // Fail-open guard: under Redis slowness/failure, do not block request handling.
  // This protects hot paths from transport-level collapse caused by limiter latency.
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('RATE_LIMIT_TIMEOUT')), RATE_LIMIT_TIMEOUT_MS)
  })

  try {
    const { success, limit, remaining, reset } = await Promise.race([
      limiter.limit(identifier),
      timeout,
    ])

    return { success, limit, remaining, reset }
  } catch {
    return {
      success: true,
      limit: 999999,
      remaining: 999999,
      reset: Date.now() + 60000,
    }
  }
}

/**
 * Rate limit response headers
 */
export function getRateLimitHeaders(result: {
  limit: number
  remaining: number
  reset: number
}) {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.reset).toISOString(),
  }
}

/**
 * Apply rate limit to a request
 * Convenience function for API routes
 */
export async function applyRateLimit(
  request: Request,
  type: 'auth' | 'api' | 'public' | 'webhook' | 'polling' = 'api'
): Promise<{
  success: boolean
  limit: number
  remaining: number
  reset: number
}> {
  const limiter = rateLimiters[type]
  const identifier = getClientIdentifier(request)
  
  return await checkRateLimit(limiter, identifier)
}




