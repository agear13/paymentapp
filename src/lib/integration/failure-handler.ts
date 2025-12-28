/**
 * Integration Failure Handler
 * 
 * Centralized error handling for external API integrations:
 * - Stripe API failures
 * - Hedera network downtime
 * - Xero API failures
 * - CoinGecko rate provider failures
 * - Webhook delivery failures
 * 
 * Sprint 24: Circuit breaker pattern, categorized errors, retry strategies
 */

import { log } from '@/lib/logger';
import { prisma } from '@/lib/db';

// ============================================================================
// Type Definitions
// ============================================================================

export type IntegrationType = 'STRIPE' | 'HEDERA' | 'XERO' | 'COINGECKO' | 'WEBHOOK';

export type ErrorCategory = 
  | 'NETWORK'        // Network timeout, connection refused
  | 'RATE_LIMIT'     // API rate limiting
  | 'AUTH'           // Authentication/authorization failure
  | 'VALIDATION'     // Invalid request (permanent)
  | 'NOT_FOUND'      // Resource not found (permanent)
  | 'SERVER_ERROR'   // 5xx errors (retryable)
  | 'TIMEOUT'        // Request timeout
  | 'UNKNOWN';       // Unknown error

export interface FailureResult {
  shouldRetry: boolean;
  retryAfterMs?: number;
  category: ErrorCategory;
  message: string;
  permanent: boolean; // True if retry won't help
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
}

// ============================================================================
// Error Categorization
// ============================================================================

/**
 * Categorize error from Stripe API
 */
export function categorizeStripeError(error: any): ErrorCategory {
  if (error.type === 'StripeConnectionError') {
    return 'NETWORK';
  }
  if (error.type === 'StripeRateLimitError') {
    return 'RATE_LIMIT';
  }
  if (error.type === 'StripeAuthenticationError') {
    return 'AUTH';
  }
  if (error.type === 'StripeInvalidRequestError') {
    return 'VALIDATION';
  }
  if (error.statusCode && error.statusCode >= 500) {
    return 'SERVER_ERROR';
  }
  return 'UNKNOWN';
}

/**
 * Categorize error from Hedera network
 */
export function categorizeHederaError(error: any): ErrorCategory {
  const message = error.message?.toLowerCase() || '';
  
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'TIMEOUT';
  }
  if (message.includes('network') || message.includes('connection')) {
    return 'NETWORK';
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'RATE_LIMIT';
  }
  if (message.includes('not found') || message.includes('does not exist')) {
    return 'NOT_FOUND';
  }
  if (message.includes('invalid') || message.includes('malformed')) {
    return 'VALIDATION';
  }
  return 'UNKNOWN';
}

/**
 * Categorize error from Xero API
 */
export function categorizeXeroError(error: any): ErrorCategory {
  const statusCode = error.statusCode || error.response?.status;
  
  if (statusCode === 401 || statusCode === 403) {
    return 'AUTH';
  }
  if (statusCode === 429) {
    return 'RATE_LIMIT';
  }
  if (statusCode === 400) {
    return 'VALIDATION';
  }
  if (statusCode === 404) {
    return 'NOT_FOUND';
  }
  if (statusCode && statusCode >= 500) {
    return 'SERVER_ERROR';
  }
  if (error.message?.includes('timeout')) {
    return 'TIMEOUT';
  }
  if (error.message?.includes('network') || error.code === 'ECONNREFUSED') {
    return 'NETWORK';
  }
  return 'UNKNOWN';
}

/**
 * Categorize error from CoinGecko API
 */
export function categorizeCoinGeckoError(error: any): ErrorCategory {
  const statusCode = error.response?.status || error.statusCode;
  
  if (statusCode === 429) {
    return 'RATE_LIMIT';
  }
  if (statusCode && statusCode >= 500) {
    return 'SERVER_ERROR';
  }
  if (error.message?.includes('timeout')) {
    return 'TIMEOUT';
  }
  if (error.message?.includes('network') || error.code === 'ECONNREFUSED') {
    return 'NETWORK';
  }
  return 'UNKNOWN';
}

// ============================================================================
// Failure Handling
// ============================================================================

/**
 * Handle integration failure and determine retry strategy
 */
export function handleIntegrationFailure(
  integrationType: IntegrationType,
  error: any,
  attemptNumber: number = 1
): FailureResult {
  let category: ErrorCategory;

  // Categorize error based on integration type
  switch (integrationType) {
    case 'STRIPE':
      category = categorizeStripeError(error);
      break;
    case 'HEDERA':
      category = categorizeHederaError(error);
      break;
    case 'XERO':
      category = categorizeXeroError(error);
      break;
    case 'COINGECKO':
      category = categorizeCoinGeckoError(error);
      break;
    default:
      category = 'UNKNOWN';
  }

  const message = error.message || 'Unknown error';
  
  // Determine if permanent (no point retrying)
  const permanent = category === 'VALIDATION' || category === 'NOT_FOUND' || category === 'AUTH';

  // Determine retry strategy
  let shouldRetry = !permanent && attemptNumber < 5;
  let retryAfterMs: number | undefined;

  if (category === 'RATE_LIMIT') {
    // For rate limits, use exponential backoff starting at 60 seconds
    retryAfterMs = Math.min(60000 * Math.pow(2, attemptNumber - 1), 3600000); // Max 1 hour
    shouldRetry = attemptNumber < 10; // More retries for rate limits
  } else if (category === 'NETWORK' || category === 'TIMEOUT' || category === 'SERVER_ERROR') {
    // For transient errors, use exponential backoff
    retryAfterMs = Math.min(1000 * Math.pow(2, attemptNumber), 60000); // Max 1 minute
  } else if (category === 'UNKNOWN') {
    // For unknown errors, be conservative
    retryAfterMs = 5000 * attemptNumber; // Linear backoff
    shouldRetry = attemptNumber < 3; // Fewer retries
  }

  log.warn(
    {
      integrationType,
      category,
      attemptNumber,
      shouldRetry,
      retryAfterMs,
      permanent,
      error: message,
    },
    'Integration failure handled'
  );

  return {
    shouldRetry,
    retryAfterMs,
    category,
    message,
    permanent,
  };
}

// ============================================================================
// Circuit Breaker
// ============================================================================

// In-memory circuit breaker state (in production, use Redis)
const circuitBreakers = new Map<string, CircuitBreakerState>();

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,        // Open after 5 failures
  resetTimeoutMs: 60000,       // Try again after 1 minute
  halfOpenAttempts: 3,         // Allow 3 attempts when half-open
};

/**
 * Get circuit breaker state for an integration
 */
export function getCircuitBreakerState(
  integrationType: IntegrationType,
  identifier?: string
): CircuitBreakerState {
  const key = identifier ? `${integrationType}:${identifier}` : integrationType;
  
  const state = circuitBreakers.get(key) || {
    state: 'CLOSED',
    failureCount: 0,
  };

  // Auto-transition from OPEN to HALF_OPEN after timeout
  if (
    state.state === 'OPEN' &&
    state.nextRetryTime &&
    state.nextRetryTime <= new Date()
  ) {
    state.state = 'HALF_OPEN';
    state.failureCount = 0;
  }

  return state;
}

/**
 * Record a successful call (closes circuit or resets failures)
 */
export function recordSuccess(
  integrationType: IntegrationType,
  identifier?: string
): void {
  const key = identifier ? `${integrationType}:${identifier}` : integrationType;
  
  const state = getCircuitBreakerState(integrationType, identifier);
  
  if (state.state === 'HALF_OPEN') {
    log.info(
      { integrationType, identifier, key },
      'Circuit breaker closed after successful recovery'
    );
  }

  // Reset to closed state
  circuitBreakers.set(key, {
    state: 'CLOSED',
    failureCount: 0,
  });
}

/**
 * Record a failure (may open circuit)
 */
export function recordFailure(
  integrationType: IntegrationType,
  category: ErrorCategory,
  identifier?: string
): CircuitBreakerState {
  const key = identifier ? `${integrationType}:${identifier}` : integrationType;
  const state = getCircuitBreakerState(integrationType, identifier);

  // Don't count permanent failures towards circuit breaker
  if (category === 'VALIDATION' || category === 'NOT_FOUND') {
    return state;
  }

  state.failureCount++;
  state.lastFailureTime = new Date();

  if (state.failureCount >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
    state.state = 'OPEN';
    state.nextRetryTime = new Date(
      Date.now() + CIRCUIT_BREAKER_CONFIG.resetTimeoutMs
    );

    log.error(
      {
        integrationType,
        identifier,
        key,
        failureCount: state.failureCount,
        nextRetryTime: state.nextRetryTime,
      },
      'Circuit breaker opened due to repeated failures'
    );

    // Record alert
    recordCircuitBreakerAlert(integrationType, identifier);
  }

  circuitBreakers.set(key, state);
  return state;
}

/**
 * Check if circuit breaker allows request
 */
export function isCircuitBreakerOpen(
  integrationType: IntegrationType,
  identifier?: string
): boolean {
  const state = getCircuitBreakerState(integrationType, identifier);
  return state.state === 'OPEN';
}

// ============================================================================
// Alert Recording
// ============================================================================

/**
 * Record circuit breaker alert in database
 */
async function recordCircuitBreakerAlert(
  integrationType: IntegrationType,
  identifier?: string
): Promise<void> {
  try {
    // This would integrate with the alerting system
    log.error(
      {
        integrationType,
        identifier,
        alertType: 'CIRCUIT_BREAKER_OPEN',
      },
      'ALERT: Circuit breaker opened'
    );

    // TODO: Send email notification
    // TODO: Create alert in database
  } catch (error) {
    log.error({ error }, 'Failed to record circuit breaker alert');
  }
}

// ============================================================================
// Hedera Network Health Check
// ============================================================================

/**
 * Check Hedera network health
 */
export async function checkHederaNetworkHealth(): Promise<{
  isHealthy: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    // Try to fetch account info for a well-known account (Hedera treasury)
    const response = await fetch(
      'https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/0.0.2',
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) {
      return {
        isHealthy: false,
        error: `Mirror node returned ${response.status}`,
      };
    }

    const latencyMs = Date.now() - startTime;

    return {
      isHealthy: true,
      latencyMs,
    };
  } catch (error: any) {
    return {
      isHealthy: false,
      latencyMs: Date.now() - startTime,
      error: error.message,
    };
  }
}

// ============================================================================
// Rate Staleness Detection
// ============================================================================

/**
 * Check if FX rate is stale
 */
export async function checkFxRateStaleness(
  paymentLinkId: string
): Promise<{
  isStale: boolean;
  ageMinutes: number;
  message?: string;
}> {
  const snapshot = await prisma.fx_snapshots.findFirst({
    where: {
      payment_link_id: paymentLinkId,
      snapshot_type: 'CREATION',
    },
    orderBy: { captured_at: 'desc' },
  });

  if (!snapshot) {
    return {
      isStale: true,
      ageMinutes: Infinity,
      message: 'No FX snapshot found',
    };
  }

  const ageMs = Date.now() - snapshot.captured_at.getTime();
  const ageMinutes = ageMs / (1000 * 60);

  // Consider stale if older than 15 minutes
  const isStale = ageMinutes > 15;

  return {
    isStale,
    ageMinutes,
    message: isStale
      ? `FX rate is ${ageMinutes.toFixed(1)} minutes old (stale)`
      : `FX rate is ${ageMinutes.toFixed(1)} minutes old (fresh)`,
  };
}

// ============================================================================
// Webhook Delivery Tracking
// ============================================================================

/**
 * Record webhook delivery attempt
 */
export async function recordWebhookDelivery(
  webhookType: 'STRIPE' | 'XERO',
  eventId: string,
  success: boolean,
  error?: string
): Promise<void> {
  try {
    log.info(
      {
        webhookType,
        eventId,
        success,
        error,
      },
      'Webhook delivery recorded'
    );

    // In production, you'd store this in a webhooks table
    // For now, we'll use the generic audit system
  } catch (err) {
    log.error({ err }, 'Failed to record webhook delivery');
  }
}

/**
 * Get webhook delivery statistics
 */
export async function getWebhookStats(
  webhookType: 'STRIPE' | 'XERO',
  hoursBack: number = 24
): Promise<{
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  successRate: number;
}> {
  // This would query a webhooks table in production
  // For now, return mock data
  return {
    totalAttempts: 100,
    successCount: 98,
    failureCount: 2,
    successRate: 0.98,
  };
}







