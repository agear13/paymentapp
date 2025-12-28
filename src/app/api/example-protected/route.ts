/**
 * Example Protected API Route
 * Demonstrates authentication, rate limiting, and error handling
 */

import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/middleware'
import { withApiMiddleware, apiResponse } from '@/lib/api/middleware'
import { loggers } from '@/lib/logger'

async function handler(request: NextRequest, { user }: { user: any }) {
  loggers.api.info('Protected endpoint accessed', {
    userId: user.id,
    email: user.email,
  })

  return apiResponse({
    message: 'This is a protected route',
    user: {
      id: user.id,
      email: user.email,
    },
  })
}

// Combine auth and API middleware
export const GET = withApiMiddleware(
  withAuth(handler),
  { rateLimit: 'api', cors: true }
)













