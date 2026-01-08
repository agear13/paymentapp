/**
 * Correlation ID Service
 * Provides distributed tracing across payment processing pipeline
 */

import { randomUUID } from 'crypto';

export type CorrelationSource = 'stripe' | 'hedera' | 'xero' | 'system';

/**
 * Generate a correlation ID for tracking payment flow
 * Format: source_reference_timestamp_random
 */
export function generateCorrelationId(
  source: CorrelationSource,
  reference: string
): string {
  const timestamp = Date.now();
  const random = randomUUID().split('-')[0];
  return `${source}_${reference}_${timestamp}_${random}`;
}

/**
 * Extract components from correlation ID
 */
export function parseCorrelationId(correlationId: string) {
  const parts = correlationId.split('_');
  
  if (parts.length < 4) {
    return null;
  }
  
  return {
    source: parts[0] as CorrelationSource,
    reference: parts[1],
    timestamp: parseInt(parts[2]),
    random: parts[3],
  };
}

/**
 * Validate correlation ID format
 */
export function isValidCorrelationId(correlationId: string): boolean {
  const parsed = parseCorrelationId(correlationId);
  return parsed !== null && !isNaN(parsed.timestamp);
}

/**
 * Create correlation context for logging
 */
export function createCorrelationContext(correlationId: string) {
  const parsed = parseCorrelationId(correlationId);
  
  if (!parsed) {
    return { correlationId };
  }
  
  return {
    correlationId,
    source: parsed.source,
    reference: parsed.reference,
    timestamp: new Date(parsed.timestamp).toISOString(),
  };
}

