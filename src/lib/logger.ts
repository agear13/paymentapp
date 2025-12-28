/**
 * Structured Logging Infrastructure
 * Using Pino for high-performance structured logging
 */

import pino from 'pino'

// Determine log level from environment
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

// Create base logger configuration
// Note: pino-pretty transport doesn't work well with Next.js due to thread-stream issues
// Using simple JSON logging for both dev and production
const loggerConfig: pino.LoggerOptions = {
  level: logLevel,
  // Always use JSON format for Next.js compatibility
  formatters: {
    level: (label) => {
      return { level: label }
    },
  },
}

// Create logger instance
export const logger = pino(loggerConfig)

/**
 * Create child logger with context
 */
export function createLogger(context: Record<string, any>) {
  return logger.child(context)
}

/**
 * Log levels and convenience methods
 */
export const log = {
  trace: (msg: string, data?: any) => logger.trace(data, msg),
  debug: (msg: string, data?: any) => logger.debug(data, msg),
  info: (msg: string, data?: any) => logger.info(data, msg),
  warn: (msg: string, data?: any) => logger.warn(data, msg),
  error: (msg: string, error?: Error | any, data?: any) => {
    if (error instanceof Error) {
      logger.error({ ...data, err: error }, msg)
    } else {
      logger.error({ ...data, error }, msg)
    }
  },
  fatal: (msg: string, error?: Error | any, data?: any) => {
    if (error instanceof Error) {
      logger.fatal({ ...data, err: error }, msg)
    } else {
      logger.fatal({ ...data, error }, msg)
    }
  },
}

/**
 * Domain-specific loggers
 */
export const loggers = {
  auth: createLogger({ domain: 'auth' }),
  payment: createLogger({ domain: 'payment' }),
  ledger: createLogger({ domain: 'ledger' }),
  xero: createLogger({ domain: 'xero' }),
  api: createLogger({ domain: 'api' }),
  webhook: createLogger({ domain: 'webhook' }),
  database: createLogger({ domain: 'database' }),
  cache: createLogger({ domain: 'cache' }),
}

/**
 * Request logging middleware
 */
export function logRequest(
  method: string,
  url: string,
  userId?: string,
  duration?: number,
  status?: number
) {
  logger.info({
    type: 'request',
    method,
    url,
    userId,
    duration,
    status,
  })
}

/**
 * Error logging with context
 */
export function logError(
  error: Error,
  context: {
    domain?: string
    userId?: string
    organizationId?: string
    paymentLinkId?: string
    [key: string]: any
  }
) {
  logger.error({
    ...context,
    err: error,
    stack: error.stack,
  })
}

/**
 * Audit log for important actions
 */
export function logAudit(
  action: string,
  userId: string,
  details: Record<string, any>
) {
  logger.info({
    type: 'audit',
    action,
    userId,
    timestamp: new Date().toISOString(),
    ...details,
  })
}

/**
 * Performance logging
 */
export function logPerformance(
  operation: string,
  duration: number,
  metadata?: Record<string, any>
) {
  logger.info({
    type: 'performance',
    operation,
    duration,
    ...metadata,
  })
}

export default logger



