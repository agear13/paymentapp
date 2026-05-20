/**
 * Operational payment status language — certainty-oriented, not backend implementation detail.
 */

import type { MatchConfidence } from '@prisma/client';

export type PaymentLinkOperationalStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'PAID_UNVERIFIED'
  | 'REQUIRES_REVIEW'
  | 'PAID'
  | 'EXPIRED'
  | 'CANCELED';

export function operationalStatusLabel(status: string): string {
  switch (status) {
    case 'OPEN':
      return 'Awaiting payment';
    case 'PAID_UNVERIFIED':
      return 'Payment reported';
    case 'REQUIRES_REVIEW':
      return 'Awaiting review';
    case 'PAID':
      return 'Verified';
    case 'EXPIRED':
      return 'Expired';
    case 'CANCELED':
      return 'Canceled';
    case 'DRAFT':
      return 'Draft';
    default:
      return status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  }
}

export function operationalStatusDescription(status: string): string {
  switch (status) {
    case 'OPEN':
      return 'No payment has been reported yet.';
    case 'PAID_UNVERIFIED':
      return 'Customer reported payment. Verification pending.';
    case 'REQUIRES_REVIEW':
      return 'Operator or system review needed before advancing settlement.';
    case 'PAID':
      return 'Payment verified and recorded operationally.';
    case 'EXPIRED':
      return 'This invoice is no longer accepting payment.';
    case 'CANCELED':
      return 'This invoice was canceled.';
    default:
      return '';
  }
}

export function verificationConfidenceLabel(
  confidence: MatchConfidence | string | null,
  verificationStatus: string | null,
  issueCount: number
): string {
  if (verificationStatus === 'FLAGGED' || issueCount >= 3) {
    return 'Flagged mismatch';
  }
  if (confidence === 'HIGH' && issueCount === 0 && verificationStatus === 'VERIFIED') {
    return 'High confidence';
  }
  if (confidence === 'MEDIUM' || issueCount > 0) {
    return 'Verification recommended';
  }
  if (confidence === 'LOW') {
    return 'Awaiting review';
  }
  if (verificationStatus === 'VERIFIED') {
    return 'Verified';
  }
  return 'Awaiting review';
}

export function formatRelativeUpdateTime(isoTimestamp: string | null | undefined): string | null {
  if (!isoTimestamp) return null;
  const then = new Date(isoTimestamp).getTime();
  if (Number.isNaN(then)) return null;
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 15) return 'Updated just now';
  if (diffSec < 60) return `Updated ${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Updated ${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `Updated ${diffHr}h ago`;
}
