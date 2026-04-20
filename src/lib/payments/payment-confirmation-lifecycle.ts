import type { PaymentLinkStatus } from '@prisma/client';

type VerificationTuple = {
  verification_status: string;
  match_confidence: string;
};

/**
 * Canonical manual-confirmation lifecycle for Payment Links rails.
 * OPEN -> PAID_UNVERIFIED -> (optional) REQUIRES_REVIEW based on verification.
 */
export function statusAfterManualConfirmationVerification(
  verification: VerificationTuple
): Extract<PaymentLinkStatus, 'PAID_UNVERIFIED' | 'REQUIRES_REVIEW'> {
  if (
    verification.verification_status === 'FLAGGED' ||
    verification.match_confidence === 'LOW'
  ) {
    return 'REQUIRES_REVIEW';
  }
  return 'PAID_UNVERIFIED';
}

