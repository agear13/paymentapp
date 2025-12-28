/**
 * Sentry Edge Runtime Configuration
 * This file configures Sentry for Edge Runtime (Middleware)
 */

import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Adjust this value in production
    tracesSampleRate: 1.0,
    
    environment: process.env.NODE_ENV || 'development',
  })
}













