/**
 * Structured Logging Infrastructure
 * Using Pino for high-performance structured logging
 */

import pino from 'pino'

// -----------------------------------------------------------------------------
// Logger base
// -----------------------------------------------------------------------------

const logLevel =
  process.env.LOG_LEVEL ||
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

const loggerConfig: pino.LoggerOptions = {
  level: logLevel,
  formatters: {
    level: (label) => ({ level: label }),
  },
}

// Base pino instance
export const logger = pino(loggerConfig)

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type LogData = Record<string, unknown> | undefined

export type AppLogger = {
  trace: (msg: string, data?: LogData) => void
  debug: (msg: string, data?: LogData) => void
  info: (msg: string, data?: LogData) => void
  warn: (msg: string, data?: LogData) => void
  error: (msg: string, error?: unknown, data?: LogData) => void
  fatal: (msg: string, error?: unknown, data?: LogData) => void
  child: (context: Record<string, unknown>) => AppLogger
}

// -----------------------------------------------------------------------------
// Factory to create safe loggers (WITH .child())
// -----------------------------------------------------------------------------

function makeLogger(base: pino.Logger): AppLogger {
  return {
    trace: (msg, data) => base.trace(data, msg),
    debug: (msg, data) => base.debug(data, msg),
    info: (msg, data) => base.info(data, msg),
    warn: (msg, data) => base.warn(data, msg),

    error: (msg, error, data) => {
      if (error instanceof Error) {
        base.error({ ...data, err: error }, msg)
      } else if (error) {
        base.error({ ...data, error }, msg)
      } else {
        base.error(data, msg)
      }
    },

    fatal: (msg, error, data) => {
      if (error instanceof Error) {
        base.fatal({ ...data, err: error }, msg)
      } else if (error) {
        base.fatal({ ...data, error }, msg)
      } else {
        base.fatal(data, msg)
      }
    },

    // 🔑 THIS FIXES YOUR BUILD
    child: (context) => makeLogger(base.child(context)),
  }
}

// -----------------------------------------------------------------------------
// Public loggers
// -----------------------------------------------------------------------------

/**
 * Default application logger
 * Supports log.child(...)
 */
export const log = makeLogger(logger)

/**
 * Domain-specific loggers
 */
export const loggers = {
  auth: log.child({ domain: 'auth' }),
  payment: log.child({ domain: 'payment' }),
  ledger: log.child({ domain: 'ledger' }),
  xero: log.child({ domain: 'xero' }),
  api: log.child({ domain: 'api' }),
  webhook: log.child({ domain: 'webhook' }),
  database: log.child({ domain: 'database' }),
  cache: log.child({ domain: 'cache' }),
  fx: log.child({ domain: 'fx' }),
  hedera: log.child({ domain: 'hedera' }),
}

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

export function createLogger(context: Record<string, unknown>) {
  return log.child(context)
}

export function logRequest(
  method: string,
  url: string,
  userId?: string,
  duration?: number,
  status?: number
) {
  log.info('request', {
    type: 'request',
    method,
    url,
    userId,
    duration,
    status,
  })
}

export function logError(
  error: Error,
  context: {
    domain?: string
    userId?: string
    organizationId?: string
    paymentLinkId?: string
    [key: string]: unknown
  }
) {
  log.error('error', error, context)
}

export function logAudit(
  action: string,
  userId: string,
  details: Record<string, unknown>
) {
  log.info('audit', {
    type: 'audit',
    action,
    userId,
    timestamp: new Date().toISOString(),
    ...details,
  })
}

export function logPerformance(
  operation: string,
  duration: number,
  metadata?: Record<string, unknown>
) {
  log.info('performance', {
    type: 'performance',
    operation,
    duration,
    ...metadata,
  })
}

export default logger
