import type { PayoutStatus } from '@prisma/client';

/**
 * Airwallex transfer statuses from Create/Get Transfer and payout.transfer.*
 * webhooks. PAID is not always final at Airwallex (it can later become FAILED).
 * Provvy PAID has no outbound transitions — do not change that machine.
 * Late Airwallex FAILED after Provvy PAID is ignored by executePayoutRelease.
 */
export const AIRWALLEX_TRANSFER_STATUS = {
  IN_APPROVAL: 'IN_APPROVAL',
  SCHEDULED: 'SCHEDULED',
  OVERDUE: 'OVERDUE',
  PROCESSING: 'PROCESSING',
  SENT: 'SENT',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  CANCELLATION_REQUESTED: 'CANCELLATION_REQUESTED',
} as const;

export type AirwallexTransferStatus =
  (typeof AIRWALLEX_TRANSFER_STATUS)[keyof typeof AIRWALLEX_TRANSFER_STATUS];

export type MappedAirwallexPayoutStatus = Extract<
  PayoutStatus,
  'SUBMITTED' | 'PROCESSING' | 'PAID' | 'FAILED'
>;

/**
 * SCHEDULED/IN_APPROVAL/OVERDUE map to PROCESSING (not SUBMITTED) so submit
 * persists providerReference. adapterResultToEvent drops SUBMITTED results.
 * SENT is in-flight, not paid.
 */
const AIRWALLEX_TO_PROVVY: Record<AirwallexTransferStatus, MappedAirwallexPayoutStatus> = {
  IN_APPROVAL: 'PROCESSING',
  SCHEDULED: 'PROCESSING',
  OVERDUE: 'PROCESSING',
  PROCESSING: 'PROCESSING',
  SENT: 'PROCESSING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELLED: 'FAILED',
  CANCELLATION_REQUESTED: 'PROCESSING',
};

export function isAirwallexTransferStatus(value: unknown): value is AirwallexTransferStatus {
  return typeof value === 'string' && value in AIRWALLEX_TO_PROVVY;
}

export function mapAirwallexStatusToProvvy(status: unknown): MappedAirwallexPayoutStatus | null {
  if (!isAirwallexTransferStatus(status)) return null;
  return AIRWALLEX_TO_PROVVY[status];
}

export function airwallexStatusLabel(status: unknown): string | null {
  if (!isAirwallexTransferStatus(status)) return null;
  if (status === 'PAID') {
    return 'Paid (Airwallex PAID is not always final; Provvy PAID is terminal)';
  }
  return status.replaceAll('_', ' ');
}

export function airwallexProviderReference(transferId: string): string {
  return `airwallex:${transferId}`;
}

export function parseAirwallexTransferId(
  providerReference: string | null | undefined
): string | null {
  if (!providerReference) return null;
  const trimmed = providerReference.trim();
  if (trimmed.startsWith('airwallex:')) {
    const id = trimmed.slice('airwallex:'.length).trim();
    return id || null;
  }
  return trimmed || null;
}
