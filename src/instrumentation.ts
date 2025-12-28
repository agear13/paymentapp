/**
 * Next.js Instrumentation
 * Used for initializing monitoring and observability tools
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize Sentry for Node.js runtime
    await import('./sentry.server.config')
    
    // Initialize other server-side instrumentation here
    const { logger } = await import('./lib/logger')
    logger.info('Server instrumentation initialized')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Initialize Sentry for Edge runtime
    await import('./sentry.edge.config')
  }
}













