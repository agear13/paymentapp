/**
 * Rate Limiting Configuration
 * Protects API routes from abuse using Upstash Redis
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

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
        analytics: true,
        prefix: 'ratelimit:auth',
      })
    : null,

  // Standard rate limit for API endpoints
  api: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '15 m'), // 100 requests per 15 minutes
        analytics: true,
        prefix: 'ratelimit:api',
      })
    : null,

  // Generous rate limit for public payment pages
  public: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '1 m'), // 30 requests per minute
        analytics: true,
        prefix: 'ratelimit:public',
      })
    : null,

  // Webhook rate limit
  webhook: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(1000, '1 m'), // 1000 requests per minute
        analytics: true,
        prefix: 'ratelimit:webhook',
      })
    : null,

  // Polling rate limit - higher limit for frequent status checks
  polling: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(300, '15 m'), // 300 requests per 15 minutes (1 per 3 seconds)
        analytics: true,
        prefix: 'ratelimit:polling',
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

  const { success, limit, remaining, reset } = await limiter.limit(identifier)

  return { success, limit, remaining, reset }
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




