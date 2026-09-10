import type { PayoutStatus } from '@prisma/client';

/**
 * Cregis wallet payout statuses from POST /api/v1/payout/query
 * (https://developer.cregis.com/api-reference/request-apis/payout/payout-query).
 *
 * Callbacks document only 2, 4, 6, 7 as one-shot notify statuses
 * (https://developer.cregis.com/api-reference/callback/payout).
 */
export const CREGIS_PAYOUT_STATUS = {
  AWAITING_AUDIT: 0,
  SIGN_PASS: 1,
  SIGN_REJECT: 2,
  AUDIT_CANCEL: 3,
  AUDIT_REJECT: 4,
  AWAITING_SIGN: 5,
  TRANSACTION_SUCCESS: 6,
  TRANSACTION_FAIL: 7,
} as const;

export type CregisPayoutStatusCode = (typeof CREGIS_PAYOUT_STATUS)[keyof typeof CREGIS_PAYOUT_STATUS];

export type MappedCregisPayoutStatus = Extract<PayoutStatus, 'PROCESSING' | 'PAID' | 'FAILED'>;

const CREGIS_TO_PROVVY: Record<CregisPayoutStatusCode, MappedCregisPayoutStatus> = {
  [CREGIS_PAYOUT_STATUS.AWAITING_AUDIT]: 'PROCESSING',
  [CREGIS_PAYOUT_STATUS.SIGN_PASS]: 'PROCESSING',
  [CREGIS_PAYOUT_STATUS.SIGN_REJECT]: 'FAILED',
  [CREGIS_PAYOUT_STATUS.AUDIT_CANCEL]: 'FAILED',
  [CREGIS_PAYOUT_STATUS.AUDIT_REJECT]: 'FAILED',
  [CREGIS_PAYOUT_STATUS.AWAITING_SIGN]: 'PROCESSING',
  [CREGIS_PAYOUT_STATUS.TRANSACTION_SUCCESS]: 'PAID',
  [CREGIS_PAYOUT_STATUS.TRANSACTION_FAIL]: 'FAILED',
};

const CREGIS_STATUS_LABEL: Record<CregisPayoutStatusCode, string> = {
  [CREGIS_PAYOUT_STATUS.AWAITING_AUDIT]: 'Awaiting audit',
  [CREGIS_PAYOUT_STATUS.SIGN_PASS]: 'Sign pass',
  [CREGIS_PAYOUT_STATUS.SIGN_REJECT]: 'Signature rejected',
  [CREGIS_PAYOUT_STATUS.AUDIT_CANCEL]: 'Audit cancel',
  [CREGIS_PAYOUT_STATUS.AUDIT_REJECT]: 'Approval rejected',
  [CREGIS_PAYOUT_STATUS.AWAITING_SIGN]: 'Awaiting sign',
  [CREGIS_PAYOUT_STATUS.TRANSACTION_SUCCESS]: 'Transaction successful',
  [CREGIS_PAYOUT_STATUS.TRANSACTION_FAIL]: 'Transaction failed',
};

export function isCregisPayoutStatusCode(value: unknown): value is CregisPayoutStatusCode {
  return (
    value === 0 ||
    value === 1 ||
    value === 2 ||
    value === 3 ||
    value === 4 ||
    value === 5 ||
    value === 6 ||
    value === 7
  );
}

export function mapCregisStatusToProvvy(status: unknown): MappedCregisPayoutStatus | null {
  const numeric = typeof status === 'string' && status.trim() !== '' ? Number(status) : status;
  if (!isCregisPayoutStatusCode(numeric)) return null;
  return CREGIS_TO_PROVVY[numeric];
}

export function cregisStatusLabel(status: unknown): string | null {
  const numeric = typeof status === 'string' && status.trim() !== '' ? Number(status) : status;
  if (!isCregisPayoutStatusCode(numeric)) return null;
  return CREGIS_STATUS_LABEL[numeric];
}

export function cregisProviderReference(cid: string | number): string {
  return `cregis:${cid}`;
}

export function parseCregisCid(providerReference: string | null | undefined): string | null {
  if (!providerReference) return null;
  const trimmed = providerReference.trim();
  if (trimmed.startsWith('cregis:')) {
    const cid = trimmed.slice('cregis:'.length).trim();
    return cid || null;
  }
  if (/^\d+$/.test(trimmed)) return trimmed;
  return null;
}
