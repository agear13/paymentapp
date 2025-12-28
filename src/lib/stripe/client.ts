/**
 * Stripe Client Singleton
 * Server-side Stripe API client with error handling
 */

import Stripe from 'stripe';
import { log } from '@/lib/logger';

// Read environment variables
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
const isDisabled = !stripeSecretKey || stripeSecretKey.toLowerCase() === 'disabled';

// Handle disabled mode
if (isDisabled) {
  log.warn('Stripe is disabled - using placeholder client. Set STRIPE_SECRET_KEY to enable Stripe payments.');
}

/**
 * Stripe client singleton instance
 * Configured with API version and error handling
 * Uses placeholder key when disabled for safe deployment
 */
export const stripe = new Stripe(
  isDisabled ? 'sk_test_placeholder_disabled_mode_12345678901234567890123456789012' : stripeSecretKey,
  {
    apiVersion: '2025-02-24.acacia',
    typescript: true,
    appInfo: {
      name: 'Provvypay',
      version: '1.0.0',
    },
  }
);

/**
 * Check if Stripe is enabled
 */
export const isStripeEnabled = !isDisabled;

/**
 * Helper function to handle Stripe errors
 */
export function handleStripeError(error: any): {
  message: string;
  code?: string;
  statusCode: number;
} {
  if (error instanceof Stripe.errors.StripeError) {
    log.error(
      {
        type: error.type,
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
      },
      'Stripe API error'
    );

    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode || 500,
    };
  }

  log.error({ error: error.message }, 'Unknown Stripe error');
  return {
    message: 'An unexpected error occurred',
    statusCode: 500,
  };
}

/**
 * Calculate amount in smallest currency unit (cents for USD, pence for GBP, etc.)
 */
export function toSmallestUnit(amount: number, currency: string): number {
  // Zero-decimal currencies (e.g., JPY, KRW)
  const zeroDecimalCurrencies = ['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'];
  
  if (zeroDecimalCurrencies.includes(currency.toUpperCase())) {
    return Math.round(amount);
  }
  
  // Most currencies use 2 decimal places
  return Math.round(amount * 100);
}

/**
 * Convert from smallest unit back to decimal
 */
export function fromSmallestUnit(amount: number, currency: string): number {
  const zeroDecimalCurrencies = ['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'];
  
  if (zeroDecimalCurrencies.includes(currency.toUpperCase())) {
    return amount;
  }
  
  return amount / 100;
}

/**
 * Generate idempotency key for Stripe API calls
 */
export function generateIdempotencyKey(paymentLinkId: string, prefix: string = 'pi'): string {
  return `${prefix}_${paymentLinkId}_${Date.now()}`;
}













