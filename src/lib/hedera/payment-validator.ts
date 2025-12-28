/**
 * Hedera Payment Validation Service
 * Token-specific validation with different tolerances
 */

import { log } from '@/lib/logger';
import { PAYMENT_TOLERANCES, type TokenType } from './constants';
import type { PaymentValidation } from './types';

/**
 * Validate a payment amount with token-specific tolerance
 */
export function validatePaymentAmount(
  requiredAmount: number,
  receivedAmount: number,
  tokenType: TokenType
): PaymentValidation {
  const tolerance = PAYMENT_TOLERANCES[tokenType];
  const difference = receivedAmount - requiredAmount;
  const differencePercent = (difference / requiredAmount) * 100;
  const tolerancePercent = tolerance * 100;

  // Calculate min/max acceptable amounts
  const minAcceptable = requiredAmount * (1 - tolerance);
  const maxAcceptable = requiredAmount * (1 + tolerance);

  const isUnderpayment = receivedAmount < minAcceptable;
  const isOverpayment = receivedAmount > maxAcceptable;
  const isValid = !isUnderpayment && !isOverpayment;

  let message: string | undefined;

  if (isUnderpayment) {
    message = `Underpayment: Received ${receivedAmount.toFixed(8)} ${tokenType}, ` +
      `required ${requiredAmount.toFixed(8)} ${tokenType} ` +
      `(tolerance: ${tolerancePercent}%)`;
  } else if (isOverpayment) {
    message = `Overpayment: Received ${receivedAmount.toFixed(8)} ${tokenType}, ` +
      `required ${requiredAmount.toFixed(8)} ${tokenType} ` +
      `(+${differencePercent.toFixed(2)}% over tolerance)`;
  } else {
    message = `Valid payment: ${receivedAmount.toFixed(8)} ${tokenType}`;
  }

  const validation: PaymentValidation = {
    isValid,
    requiredAmount,
    receivedAmount,
    difference,
    differencePercent,
    tolerance: tolerancePercent,
    isUnderpayment,
    isOverpayment,
    tokenType,
    message,
  };

  log.info({ validation }, 'Payment validation completed');

  return validation;
}

/**
 * Validate token type matches expected
 */
export function validateTokenType(
  expectedToken: TokenType,
  receivedToken: TokenType
): { isValid: boolean; message?: string } {
  const isValid = expectedToken === receivedToken;

  if (!isValid) {
    return {
      isValid: false,
      message: `Wrong token: Expected ${expectedToken} but received ${receivedToken}. ` +
        `Please send payment using ${expectedToken}.`,
    };
  }

  return { isValid: true };
}

/**
 * Get tolerance for a specific token type
 */
export function getToleranceForToken(tokenType: TokenType): number {
  return PAYMENT_TOLERANCES[tokenType];
}

/**
 * Calculate acceptable payment range
 */
export function getAcceptableRange(
  requiredAmount: number,
  tokenType: TokenType
): { min: number; max: number; tolerance: number } {
  const tolerance = PAYMENT_TOLERANCES[tokenType];
  
  return {
    min: requiredAmount * (1 - tolerance),
    max: requiredAmount * (1 + tolerance),
    tolerance: tolerance * 100, // As percentage
  };
}

/**
 * Format validation error message for UI
 */
export function formatValidationError(validation: PaymentValidation): string {
  if (validation.isValid) {
    return 'Payment validated successfully';
  }

  if (validation.isUnderpayment) {
    const shortfall = validation.requiredAmount - validation.receivedAmount;
    return `Payment incomplete: Missing ${shortfall.toFixed(8)} ${validation.tokenType}. ` +
      `Please send the remaining amount.`;
  }

  if (validation.isOverpayment) {
    return `Payment received exceeds requested amount by ${Math.abs(validation.differencePercent).toFixed(2)}%. ` +
      `The excess will be accepted but may be subject to review.`;
  }

  return 'Payment validation failed. Please contact support.';
}

/**
 * Check if amount is within tolerance (without creating full validation)
 */
export function isWithinTolerance(
  requiredAmount: number,
  receivedAmount: number,
  tokenType: TokenType
): boolean {
  const tolerance = PAYMENT_TOLERANCES[tokenType];
  const minAcceptable = requiredAmount * (1 - tolerance);
  const maxAcceptable = requiredAmount * (1 + tolerance);
  
  return receivedAmount >= minAcceptable && receivedAmount <= maxAcceptable;
}

/**
 * Get user-friendly retry instructions for underpayment
 */
export function getRetryInstructions(
  validation: PaymentValidation,
  merchantAccountId: string
): string {
  if (!validation.isUnderpayment) {
    return '';
  }

  const shortfall = validation.requiredAmount - validation.receivedAmount;
  
  return `To complete this payment:\n\n` +
    `1. Send an additional ${shortfall.toFixed(8)} ${validation.tokenType}\n` +
    `2. To the same account: ${merchantAccountId}\n` +
    `3. Include the same memo if provided\n\n` +
    `The system will automatically detect and validate your payment.`;
}












